#!/usr/bin/env python3
"""
Generate the summary, action items and highlights for a call.

Text-only: it reads the diarized transcript, so it costs a fraction of the audio passes and is
unaffected by audio-endpoint flakiness.

Everything it produces is anchored to a timestamp. A summary you cannot trace back to the moment
it came from is just a paragraph; the anchors are what make "click the chip and hear it yourself"
possible, and they are why segment ids are fed to the model rather than plain prose.

Usage:  python3 scripts/summarize.py <episode-id> [...]
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SEED = REPO / "content" / "seed"
MODEL = "gemini-3.5-flash"
API = "https://generativelanguage.googleapis.com"


def api_key():
    for line in (REPO / "apps" / "web" / ".env").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("GEMINI_API_KEY not found in apps/web/.env")


SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING", "description": "Short meeting title, 2-6 words, no quotes"},
        "blurb": {"type": "STRING", "description": "One sentence, max 220 chars, for the library card"},
        "purpose": {"type": "STRING", "description": "One sentence: why this meeting happened"},
        "keyTakeaways": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "point": {"type": "STRING"}, "segmentId": {"type": "INTEGER"}},
            "required": ["point", "segmentId"]}},
        "topics": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "heading": {"type": "STRING"},
            "points": {"type": "ARRAY", "items": {"type": "STRING"}},
            "segmentId": {"type": "INTEGER"}},
            "required": ["heading", "points", "segmentId"]}},
        "actionItems": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "text": {"type": "STRING"},
            "assignee": {"type": "STRING", "description": "Speaker name, or '' if unclear"},
            "segmentId": {"type": "INTEGER"}},
            "required": ["text", "assignee", "segmentId"]}},
        "highlights": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "label": {"type": "STRING", "description": "Short label for a notable moment"},
            "segmentId": {"type": "INTEGER"}},
            "required": ["label", "segmentId"]}},
        "nextSteps": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["title", "blurb", "purpose", "keyTakeaways", "topics", "actionItems",
                 "highlights", "nextSteps"],
}

PROMPT = """Below is the full transcript of one recorded meeting, as numbered segments with the
speaker who said each line.

Write the meeting notes a good notetaker would leave.

Every structured item must carry the `segmentId` it is drawn from, so a reader can jump to the
moment it came from. Choose the segment where the point is actually made, not where it is
summarised later.

- title: what this meeting would be called in a calendar. Do not use the podcast episode number.
- blurb: one sentence a colleague could read in a list and know whether to open it.
- purpose: one sentence on why they met.
- keyTakeaways: 3-6 things that actually matter. Decisions and conclusions, not topic labels.
- topics: the real structure of the conversation, in order. 2-5 bullets each.
- actionItems: only genuine commitments someone made. If nobody committed to anything, return an
  empty list — do not invent work. assignee must be one of the speaker names listed below, or "".
- highlights: 3-6 genuinely notable moments worth jumping straight to.
- nextSteps: what happens after this meeting, if anything was said.

Write plainly. No filler, no "the team discussed...", no restating the obvious.

Speakers: {speakers}

Transcript:
{transcript}
"""


def generate(key, prompt, tries=4):
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA,
                                 "temperature": 0.3, "thinkingConfig": {"thinkingBudget": 8192}}}
    data = json.dumps(body).encode()
    url = f"{API}/v1beta/models/{MODEL}:generateContent?key={key}"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=900) as r:
                d = json.load(r)
            return json.loads(d["candidates"][0]["content"]["parts"][0]["text"]), d.get("usageMetadata", {})
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:250]
            if e.code in (429, 500, 503) and attempt < tries - 1:
                wait = 30 * (attempt + 1)
                print(f"    {e.code}, retrying in {wait}s", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"HTTP {e.code}: {detail}")
    sys.exit("unreachable")


def main():
    eps = sys.argv[1:] or sorted(p.name.split(".")[0] for p in SEED.glob("*.transcript.json"))
    if not eps:
        sys.exit("no diarized transcripts yet — run scripts/diarize.py first")
    key = api_key()

    for ep in eps:
        src = SEED / f"{ep}.transcript.json"
        if not src.exists():
            print(f"  {ep}: no transcript, skipped")
            continue
        out_path = SEED / f"{ep}.notes.json"
        if out_path.exists():
            print(f"  {ep}: cached")
            continue

        t = json.loads(src.read_text())
        names = {s["id"]: s["name"] for s in t["speakers"]}
        lines = "\n".join(
            f'{s["id"]}  {names.get(s["speaker"], "Unknown")}: {s["text"]}' for s in t["segments"])
        prompt = PROMPT.format(speakers=", ".join(names.values()), transcript=lines)

        print(f"  {ep}: {len(t['segments'])} segments ...", end=" ", flush=True)
        t0 = time.time()
        res, usage = generate(key, prompt)

        # resolve every segmentId to the timestamp it actually sits at
        at = {s["id"]: s["startSec"] for s in t["segments"]}
        def sec(i):
            return at.get(i, 0.0)

        notes = {
            "title": res["title"],
            "blurb": res["blurb"],
            "summary": {
                "purpose": res["purpose"],
                "keyTakeaways": [{"point": k["point"], "atSec": sec(k["segmentId"])}
                                 for k in res["keyTakeaways"]],
                "topics": [{"heading": t_["heading"], "points": t_["points"],
                            "atSec": sec(t_["segmentId"])} for t_ in res["topics"]],
                "nextSteps": res["nextSteps"],
            },
            "actionItems": [{"id": f"{ep}-a{i}", "text": a["text"], "assignee": a["assignee"],
                             "atSec": sec(a["segmentId"])}
                            for i, a in enumerate(res["actionItems"])],
            "highlights": [{"id": f"{ep}-h{i}", "label": h["label"], "atSec": sec(h["segmentId"])}
                           for i, h in enumerate(res["highlights"])],
        }
        out_path.write_text(json.dumps(notes, indent=1))
        print(f'"{res["title"]}"  {len(notes["actionItems"])} actions, '
              f'{len(notes["highlights"])} highlights, {time.time()-t0:.0f}s, '
              f'{usage.get("promptTokenCount")} tokens')


if __name__ == "__main__":
    main()
