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
  4. Windows, with turns keyed by TIMESTAMP -- the model invented times past the end of the audio
     (a 35-minute slice came back with turns at 57 minutes). Model-generated timestamps are not
     trustworthy at this length, and this product resolves everything to timestamps.

  5. Windows processed in order, each handed the previous window's roster -- correct, but each
     window waits for the one before it, and a single window was taking 5+ minutes. Four windows
     x five calls is over an hour of pure waiting.

Final shape, in two phases:

  CASTING  one pass over the whole file to learn WHO is on the call. This is the thing the
           whole-file request was always good at -- it recovered real names (Ken, Honkeymagoo,
           Joe...) in under a minute. It does not matter that it stops paying attention halfway,
           because we only want the cast list, not the attribution.

  PASSES   every window then runs IN PARALLEL against that fixed roster, returning turns keyed by
           SEGMENT ID (the model picks from a list it was given, so it cannot invent a position,
           and out-of-range ids are dropped). A fixed roster is what removes the sequential
           dependency: no window needs to know what an earlier one decided.

Usage:  python3 scripts/diarize.py <episode-id> [--model NAME]
"""
import argparse
import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gemini  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "content" / "source-audio"
AUDIO = REPO / "apps" / "web" / "public" / "audio"
OUT = REPO / "content" / "seed"
CACHE = REPO / "content" / ".diarize-cache"
WINDOW_SEC = 20 * 60   # smaller windows finish faster, and parallelism covers the extra count
OVERLAP_SEC = 90       # replayed tail, so a turn spanning a seam is not lost
CONCURRENCY = 4        # windows are independent once the roster is fixed



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
            "fromSegmentId": {"type": "INTEGER"},
            "label": {"type": "STRING"}},
            "required": ["fromSegmentId", "label"]}},
    },
    "required": ["speakers", "turns"],
}

PROMPT = """This is {mins:.0f} minutes of audio from one group call, plus the exact transcript
segments for it. The text and timings are already correct — do not re-transcribe or re-time.

Your only job is deciding WHO is speaking.

Output speaker TURNS: one entry each time the speaker changes, identified by the segment id where
that speaker starts. The speaker holds from that segment until the next entry.

{roster}

Rules:
- The first turn must be segment {first_id}.
- Only use segment ids from the list below. Never invent one.
- Cover the whole list: the last turn should be near segment {last_id}. Do not stop early.
- Same person = same label throughout.
- name: the person's name if it is actually spoken aloud, otherwise "".
- voice: short concrete description (accent, pitch, pace).
- An automated intro/outro announcer counts as a speaker.

Segments (time in seconds from the start of this audio):
{segments}
"""

CAST_SCHEMA = {
    "type": "OBJECT",
    "properties": {"speakers": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "label": {"type": "STRING"}, "name": {"type": "STRING"}, "voice": {"type": "STRING"}},
        "required": ["label", "name", "voice"]}}},
    "required": ["speakers"],
}

CAST_PROMPT = """This is a full recording of one group call.

List every distinct person you can hear taking part. Do not transcribe anything.

- label: S1, S2, S3... in order of first appearance.
- name: the person's name if it is spoken aloud anywhere in the call, otherwise "".
- voice: a short, concrete description (accent, pitch, pace) precise enough to recognise this
  person again in a short excerpt of the same call.
- Include an automated intro/outro announcer if there is one.
"""

ROSTER_NONE = "This is the beginning of the call. Use labels S1, S2, S3... in order of first appearance."

ROSTER_KNOWN = """This is the cast of the call — everyone who takes part, identified from the full
recording. Use these exact labels:

{listing}

Only add a new label if you genuinely hear someone who is not in that list."""


def attribute(key, uri, mins, roster, segments, clip_start):
    if roster:
        listing = "\n".join(
            f'  {x["label"]} = {x["name"] or "unnamed"} ({x["voice"]})' for x in roster)
        roster_text = ROSTER_KNOWN.format(listing=listing)
    else:
        roster_text = ROSTER_NONE
    listing = "\n".join(
        f'{x["id"]}  [{x["start"] - clip_start:6.1f}s]  {x["text"]}' for x in segments)
    prompt = PROMPT.format(mins=mins, roster=roster_text, segments=listing,
                           first_id=segments[0]["id"], last_id=segments[-1]["id"])
    return gemini.generate(
        key, [{"text": prompt}, {"file_data": {"mime_type": "audio/mp3", "file_uri": uri}}],
        SCHEMA, thinking=4096)


def cast_call(key, uri):
    """One pass over the whole file to learn who is present. Attribution comes later."""
    res, _usage, model = gemini.generate(
        key,
        [{"text": CAST_PROMPT}, {"file_data": {"mime_type": "audio/mp3", "file_uri": uri}}],
        CAST_SCHEMA, thinking=4096)
    return res["speakers"], model


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
    args = ap.parse_args()
    ep = args.episode

    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    key = gemini.api_key()

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

    # ---- phase 1: casting. One pass over the whole file to learn who is on the call.
    cast_cache = CACHE / f"{ep}_cast.json"
    if cast_cache.exists():
        roster = json.loads(cast_cache.read_text())
        print(f"  cast: cached, {len(roster)} speakers")
    else:
        print("  cast: uploading whole call ...", end=" ", flush=True)
        whole_uri = gemini.upload(key, AUDIO / f"{ep}.mp3", ep)
        t0 = time.time()
        roster, used_model = cast_call(key, whole_uri)
        cast_cache.write_text(json.dumps(roster))
        print(f"{len(roster)} speakers via {used_model}, {time.time()-t0:.0f}s")
    for sp in roster:
        print(f"      {sp['label']:4} {sp['name'] or '(unnamed)':16} {sp['voice'][:50]}")

    # ---- phase 2: attribution. Windows are independent now the roster is fixed, so run them all.
    usage_total = {"in": 0, "out": 0}

    def run_window(item):
        i, (ws, we) = item
        cache = CACHE / f"{ep}_win{i}.json"
        inside = [x for x in segments if ws <= x["start"] < we]
        if not inside:
            return i, {"speakers": [], "turns": []}, inside
        if cache.exists():
            print(f"  window {i} ({ws/60:.0f}-{we/60:.0f} min): cached", flush=True)
            return i, json.loads(cache.read_text()), inside
        uri = gemini.upload(key, slice_audio(ep, ws, we), f"{ep}_w{i}")
        t0 = time.time()
        res, usage, used = attribute(key, uri, (we - ws) / 60, roster, inside, ws)
        usage_total["in"] += usage.get("promptTokenCount", 0)
        usage_total["out"] += usage.get("candidatesTokenCount", 0)
        valid = {x["id"] for x in inside}
        bad = [t for t in res["turns"] if t["fromSegmentId"] not in valid]
        res["turns"] = [t for t in res["turns"] if t["fromSegmentId"] in valid]
        reach = max((t["fromSegmentId"] for t in res["turns"]), default=inside[0]["id"])
        pct = (reach - inside[0]["id"]) / max(1, inside[-1]["id"] - inside[0]["id"]) * 100
        cache.write_text(json.dumps(res))
        print(f"  window {i} ({ws/60:.0f}-{we/60:.0f} min): {len(res['turns'])} turns, "
              f"reached {pct:.0f}%" + (f", dropped {len(bad)} bad ids" if bad else "")
              + f", {used}, {time.time()-t0:.0f}s", flush=True)
        return i, res, inside

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        outcomes = sorted(pool.map(run_window, list(enumerate(windows))), key=lambda x: x[0])

    turns = []
    for _, res, _inside in outcomes:
        roster, by_label = merge_roster(roster, res.get("speakers", []))
        seen = {t["seg"] for t in turns}
        for t in res["turns"]:
            entry = by_label.get(t["label"])
            if entry and t["fromSegmentId"] not in seen:
                turns.append({"seg": t["fromSegmentId"], "who": entry["label"]})
    used_in, used_out = usage_total["in"], usage_total["out"]

    turns.sort(key=lambda t: t["seg"])

    # canonical speaker ids, in order of first appearance
    order, ids = [], {}
    for t in turns:
        if t["who"] not in ids:
            ids[t["who"]] = len(order)
            order.append(t["who"])

    labelled, cur, ti = [], None, 0
    for s in segments:
        while ti < len(turns) and turns[ti]["seg"] <= s["id"]:
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
    last_seg = turns[-1]["seg"] if turns else 0
    print(f"  unattributed: {unattributed}   turns: {len(turns)}   "
          f"last turn at segment {last_seg}/{segments[-1]['id']}")
    print(f"  tokens: {used_in} in / {used_out} out")
    print(f"  models used: {gemini.usage_report()}")
    print(f"  -> {dst.relative_to(REPO)}")


if __name__ == "__main__":
    main()
