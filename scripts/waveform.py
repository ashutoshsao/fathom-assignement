#!/usr/bin/env python3
"""
Pre-compute waveform peaks for each call.

Done at build time, not in the browser: decoding an hour of audio client-side to draw a scrubber
would stall the page on load, and the peaks never change. Output is a short array of 0..1 values
committed with the seed data.

Usage:  python3 scripts/waveform.py [episode-id ...]
"""
import array
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
AUDIO = REPO / "apps" / "web" / "public" / "audio"
OUT = REPO / "content" / "seed"
BUCKETS = 420          # enough detail at full width, small enough to ship in JSON
SAMPLE_RATE = 8000     # peaks only need shape, not fidelity


def peaks(path, buckets=BUCKETS):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path),
         "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"],
        capture_output=True, check=True).stdout
    samples = array.array("h")
    samples.frombytes(raw[: len(raw) - (len(raw) % 2)])
    if not samples:
        return []

    size = max(1, len(samples) // buckets)
    out = []
    for i in range(buckets):
        chunk = samples[i * size : (i + 1) * size]
        if not chunk:
            break
        # RMS reads closer to perceived loudness than peak, which spikes on stray clicks
        out.append((sum(s * s for s in chunk) / len(chunk)) ** 0.5)

    # Normalising against the max gives a near-flat bar chart: an hour of continuous speech has
    # a narrow RMS range, so every bar lands around 0.6 and the scrubber reads as broken. Stretch
    # the useful band (5th-95th percentile) across the full height instead, which is what makes
    # pauses and emphasis actually visible.
    ranked = sorted(out)
    lo = ranked[int(len(ranked) * 0.05)]
    hi = ranked[int(len(ranked) * 0.95)]
    span = (hi - lo) or 1.0
    return [round(min(1.0, max(0.06, (v - lo) / span)), 3) for v in out]


def main():
    eps = sys.argv[1:] or sorted(p.stem for p in AUDIO.glob("*.mp3"))
    OUT.mkdir(parents=True, exist_ok=True)
    for ep in eps:
        src = AUDIO / f"{ep}.mp3"
        if not src.exists():
            print(f"  {ep}: no audio, skipped")
            continue
        p = peaks(src)
        (OUT / f"{ep}.waveform.json").write_text(json.dumps(p))
        bars = "".join(" ▁▂▃▄▅▆▇█"[min(8, int(v * 8))] for v in p[::6])
        print(f"  {ep}: {len(p)} peaks")
        print(f"    {bars[:100]}")


if __name__ == "__main__":
    main()
