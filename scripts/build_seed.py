#!/usr/bin/env python3
"""
Assemble the pipeline output into the call records the app actually reads.

Inputs (per episode, all produced by the other scripts in here):
    content/seed/<ep>.transcript.json   diarized segments + speakers
    content/seed/<ep>.notes.json        summary, action items, highlights
    content/seed/<ep>.waveform.json     precomputed peaks
    content/seed/meta.json              platform, recency, attribution

Output:
    apps/web/content/calls/<ep>.json    one Call record, matching lib/types.ts
    apps/web/content/index.json         the library listing, without the heavy transcripts

Splitting the index from the call records matters: the library page would otherwise have to load
every transcript (2,326 segments for one call alone) just to render a list of cards.

Usage:  python3 scripts/build_seed.py
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SEED = REPO / "content" / "seed"
OUT = REPO / "apps" / "web" / "content"

PALETTE_SIZE = 8


def initials(name):
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def main():
    meta = json.loads((SEED / "meta.json").read_text())
    src_meta = meta["source"]
    (OUT / "calls").mkdir(parents=True, exist_ok=True)

    index, missing = [], []
    for entry in meta["calls"]:
        ep = entry["episode"]
        t_path = SEED / f"{ep}.transcript.json"
        n_path = SEED / f"{ep}.notes.json"
        w_path = SEED / f"{ep}.waveform.json"
        if not (t_path.exists() and n_path.exists()):
            missing.append(ep)
            continue

        t = json.loads(t_path.read_text())
        n = json.loads(n_path.read_text())
        waveform = json.loads(w_path.read_text()) if w_path.exists() else []

        speakers = [
            {"id": s["id"], "name": s["name"], "initials": initials(s["name"]),
             "colorIndex": s["id"] % PALETTE_SIZE, "voice": s.get("voice", "")}
            for s in t["speakers"]
        ]
        by_name = {s["name"].lower(): s["id"] for s in speakers}

        call = {
            "id": ep,
            "title": entry.get("titleOverride") or n["title"],
            "daysAgo": entry["daysAgo"],
            "timeOfDay": entry["timeOfDay"],
            "durationSec": round(t["durationSec"], 2),
            "platform": entry["platform"],
            "blurb": n["blurb"],
            "speakers": speakers,
            "waveform": waveform,
            "audioUrl": f"/audio/{ep}.mp3",
            "summary": n["summary"],
            "actionItems": [
                {**a, "assignee": by_name.get((a.get("assignee") or "").lower())}
                for a in n["actionItems"]
            ],
            "highlights": n["highlights"],
            "transcript": t["segments"],
            "source": {**src_meta, "url": f"https://archive.org/details/{ep}"},
        }
        (OUT / "calls" / f"{ep}.json").write_text(json.dumps(call, separators=(",", ":")))

        index.append({k: call[k] for k in
                      ("id", "title", "daysAgo", "timeOfDay", "durationSec", "platform",
                       "blurb", "speakers", "waveform", "audioUrl", "source")})

        size = (OUT / "calls" / f"{ep}.json").stat().st_size / 1024
        print(f"  {ep}: \"{call['title'][:42]}\"  {len(call['transcript'])} segs, "
              f"{len(speakers)} speakers, {len(call['actionItems'])} actions, {size:.0f} KB")

    (OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))
    print(f"\n  index: {len(index)} calls, "
          f"{(OUT / 'index.json').stat().st_size/1024:.0f} KB")
    if missing:
        print(f"  not ready yet (need diarize + summarize): {', '.join(missing)}")
        sys.exit(0 if index else 1)


if __name__ == "__main__":
    main()
