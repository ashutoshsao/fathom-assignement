#!/usr/bin/env python3
"""
Attach speakers to an existing timestamped transcript.

HPR publishes Whisper output (accurate timings, no speaker labels). Those timings stay as the
spine; Gemini's only job is deciding who is speaking when.

How this shape was arrived at, because it is not obvious:

  1. Per-segment labels over 12-min chunks -- worked, but each chunk invented its own roster, so
     chunks disagreed (2 voices in one, 4 in the next) and stitching them produced phantom
     speakers. Output was also ~344 rows per chunk, which was the real latency cost.
  2. Turns instead of per-segment rows -- output dropped ~10x and requests got much faster.
  3. One request for the whole 110-min call -- best quality by far (it recovered real names) but
     it silently stopped at 51 minutes. Long audio truncates without erroring, which would have
     shipped as "the back half of every long call has no speakers."

So: windows big enough to keep the quality, small enough to actually finish, processed in order
with the roster carried forward so a speaker keeps one identity across the whole call.

Usage:  python3 scripts/diarize.py <episode-id> [--model NAME]
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "content" / "source-audio"
AUDIO = REPO / "apps" / "web" / "public" / "audio"
OUT = REPO / "content" / "seed"
CACHE = REPO / "content" / ".diarize-cache"
MODEL = "gemini-3.5-flash"
API = "https://generativelanguage.googleapis.com"

WINDOW_SEC = 35 * 60   # comfortably inside what one request completes
OVERLAP_SEC = 120      # replayed tail, so a turn spanning a seam is not lost


def api_key():
    for line in (REPO / "apps" / "web" / ".env").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("GEMINI_API_KEY not found in apps/web/.env")


# ---------------------------------------------------------------- transcript

def load_segments(ep):
    j = SRC / f"{ep}.json"
    if j.exists():
        segs = json.loads(j.read_text())["segments"]
        return [{"id": i, "start": round(s["start"], 2), "end": round(s["end"], 2),
                 "text": s["text"].strip()}
                for i, s in enumerate(segs) if s["text"].strip()]

    srt = SRC / f"{ep}.srt"
    if not srt.exists():
        sys.exit(f"no transcript for {ep}")

    def to_sec(ts):
        h, m, rest = ts.split(":")
        s, ms = rest.split(",")
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000

    out = []
    for block in re.split(r"\n\n+", srt.read_text(encoding="utf-8", errors="replace").strip()):
        lines = block.strip().split("\n")
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        a, b = lines[1].split("-->")
        text = " ".join(lines[2:]).strip()
        if text:
            out.append({"id": len(out), "start": round(to_sec(a.strip()), 2),
                        "end": round(to_sec(b.strip()), 2), "text": text})
    return out


# ---------------------------------------------------------------- files api

def upload(key, path, label):
    data = path.read_bytes()
    req = urllib.request.Request(
        f"{API}/upload/v1beta/files?key={key}",
        data=json.dumps({"file": {"display_name": label}}).encode(),
        headers={"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                 "X-Goog-Upload-Header-Content-Length": str(len(data)),
                 "X-Goog-Upload-Header-Content-Type": "audio/mp3",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        url = r.headers["X-Goog-Upload-URL"]
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Length": str(len(data)),
                                          "X-Goog-Upload-Offset": "0",
                                          "X-Goog-Upload-Command": "upload, finalize"})
    with urllib.request.urlopen(req) as r:
        info = json.load(r)["file"]
    while info.get("state") == "PROCESSING":
        time.sleep(2)
        with urllib.request.urlopen(f"{API}/v1beta/{info['name']}?key={key}") as r:
            info = json.load(r)
    if info.get("state") != "ACTIVE":
        sys.exit(f"upload failed: {info.get('state')}")
    return info["uri"]


def slice_audio(ep, start, end):
    dst = CACHE / f"{ep}_w{int(start)}_{int(end)}.mp3"
    if not dst.exists():
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
                        "-ss", str(start), "-t", str(end - start),
                        "-i", str(AUDIO / f"{ep}.mp3"), "-ac", "1", "-b:a", "32k", str(dst)],
                       check=True)
    return dst


# ---------------------------------------------------------------- gemini

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "speakers": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "label": {"type": "STRING"},
            "name": {"type": "STRING"},
            "voice": {"type": "STRING"}},
            "required": ["label", "name", "voice"]}},
        "turns": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "startSec": {"type": "NUMBER"},
            "label": {"type": "STRING"}},
            "required": ["startSec", "label"]}},
    },
    "required": ["speakers", "turns"],
}

PROMPT = """This is {mins:.0f} minutes of audio from one group call.

Identify who is speaking, then output speaker TURNS: one entry each time the speaker changes,
with the time in seconds FROM THE START OF THIS AUDIO.

{roster}

Rules:
- Cover the ENTIRE audio from start to finish. The last turn should be near {mins:.0f} minutes.
  Do not stop early.
- Same person = same label throughout.
- name: the person's name if it is actually spoken in the call, otherwise "".
- voice: short concrete description (accent, pitch, pace).
- An automated intro/outro announcer counts as a speaker.
"""

ROSTER_NONE = "This is the beginning of the call. Use labels S1, S2, S3... in order of first appearance."

ROSTER_KNOWN = """These speakers were already identified earlier in this same call. Re-use their
exact labels when you hear them again — it is the same conversation continuing:

{listing}

If you hear someone genuinely not in that list, add a new label continuing the sequence."""


def generate(key, model, uri, mins, roster, tries=4):
    if roster:
        listing = "\n".join(f'  {s["label"]} = {s["name"] or "unnamed"} ({s["voice"]})' for s in roster)
        roster_text = ROSTER_KNOWN.format(listing=listing)
    else:
        roster_text = ROSTER_NONE
    body = {
        "contents": [{"parts": [
            {"text": PROMPT.format(mins=mins, roster=roster_text)},
            {"file_data": {"mime_type": "audio/mp3", "file_uri": uri}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA,
                             "temperature": 0, "thinkingConfig": {"thinkingBudget": 4096}},
    }
    data = json.dumps(body).encode()
    url = f"{API}/v1beta/models/{model}:generateContent?key={key}"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1800) as r:
                d = json.load(r)
            return json.loads(d["candidates"][0]["content"]["parts"][0]["text"]), d.get("usageMetadata", {})
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()[:300]
            if e.code in (429, 500, 503) and attempt < tries - 1:
                wait = 30 * (attempt + 1)
                print(f"      {e.code}, retrying in {wait}s", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"HTTP {e.code}: {body_txt}")
    sys.exit("unreachable")


def merge_roster(roster, found):
    """Fold a window's speakers into the running roster, matching on label then on name."""
    by_label = {s["label"]: s for s in roster}
    for s in found:
        lbl, name = s["label"], (s.get("name") or "").strip()
        if lbl in by_label:
            if name and not by_label[lbl]["name"]:
                by_label[lbl]["name"] = name
            continue
        twin = next((r for r in roster if name and r["name"].lower() == name.lower()), None)
        if twin:
            by_label[lbl] = twin            # same person under a new label
            continue
        entry = {"label": lbl, "name": name, "voice": s.get("voice", "")}
        roster.append(entry)
        by_label[lbl] = entry
    return roster, by_label


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()
    ep = args.episode

    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    key = api_key()

    segments = load_segments(ep)
    total = segments[-1]["end"]
    print(f"{ep}: {len(segments)} segments, {total/60:.1f} min")

    windows, start = [], 0.0
    while start < total:
        end = min(start + WINDOW_SEC, total)
        windows.append((max(0.0, start - OVERLAP_SEC) if start else 0.0, end))
        if end >= total:
            break
        start = end
    print(f"  {len(windows)} windows of <= {WINDOW_SEC/60:.0f} min")

    roster, turns, used_in, used_out = [], [], 0, 0
    for i, (ws, we) in enumerate(windows):
        cache = CACHE / f"{ep}_win{i}_{args.model}.json"
        if cache.exists():
            res = json.loads(cache.read_text())
            print(f"  window {i} ({ws/60:.0f}-{we/60:.0f} min): cached")
        else:
            print(f"  window {i} ({ws/60:.0f}-{we/60:.0f} min): uploading ...", end=" ", flush=True)
            uri = upload(key, slice_audio(ep, ws, we), f"{ep}_w{i}")
            t0 = time.time()
            res, usage = generate(key, args.model, uri, (we - ws) / 60, roster)
            used_in += usage.get("promptTokenCount", 0)
            used_out += usage.get("candidatesTokenCount", 0)
            cache.write_text(json.dumps(res))
            cov = max((t["startSec"] for t in res["turns"]), default=0)
            print(f"{len(res['turns'])} turns, covered {cov/60:.0f}/{(we-ws)/60:.0f} min, "
                  f"{time.time()-t0:.0f}s")
        roster, by_label = merge_roster(roster, res["speakers"])
        for t in res["turns"]:
            abs_sec = ws + t["startSec"]
            if i > 0 and abs_sec < ws + OVERLAP_SEC - 1:
                continue                     # replayed tail: keep the earlier window's reading
            entry = by_label.get(t["label"])
            if entry:
                turns.append({"at": abs_sec, "who": entry["label"]})

    turns.sort(key=lambda t: t["at"])

    # canonical speaker ids, in order of first appearance
    order, ids = [], {}
    for t in turns:
        if t["who"] not in ids:
            ids[t["who"]] = len(order)
            order.append(t["who"])

    labelled, cur, ti = [], None, 0
    for s in segments:
        while ti < len(turns) and turns[ti]["at"] <= s["start"] + 0.5:
            cur = ids[turns[ti]["who"]]
            ti += 1
        labelled.append({"id": s["id"], "startSec": s["start"], "endSec": s["end"],
                         "text": s["text"], "speaker": cur})

    by_label = {s["label"]: s for s in roster}
    speakers = [{"id": i, "name": by_label[l]["name"] or f"Speaker {i+1}",
                 "voice": by_label[l]["voice"]} for i, l in enumerate(order)]

    out = {"episode": ep, "durationSec": total, "speakers": speakers, "segments": labelled}
    dst = OUT / f"{ep}.transcript.json"
    dst.write_text(json.dumps(out, indent=1))

    print(f"\n  speakers: {len(speakers)}")
    for s in speakers:
        n = sum(1 for x in labelled if x["speaker"] == s["id"])
        share = n / len(labelled) * 100
        print(f"    {s['name']:16} {n:5} segments ({share:4.1f}%)  {s['voice'][:46]}")
    unattributed = sum(1 for x in labelled if x["speaker"] is None)
    last_turn = turns[-1]["at"] if turns else 0
    print(f"  unattributed: {unattributed}   last turn at {last_turn/60:.1f}/{total/60:.1f} min")
    print(f"  tokens: {used_in} in / {used_out} out")
    print(f"  -> {dst.relative_to(REPO)}")


if __name__ == "__main__":
    main()
