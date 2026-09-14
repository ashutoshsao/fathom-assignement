import type { TranscriptSegment } from "./types";

/**
 * The timeline helpers.
 *
 * Everything in this product is a position in seconds, so these are used by the player, the
 * transcript, action items, highlights and Ask citations alike. They are pure and boring on
 * purpose — this is the code most likely to be wrong in a way that is hard to see, because a
 * subtly wrong seek looks like a working app that just feels off.
 */

/** "4:07", or "1:04:07" once a call passes an hour — which most of ours do. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "1h 49m" / "50m" — for list cards, where precision matters less than scanning speed. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Index of the segment playing at `seconds`, or -1 before the first one starts.
 *
 * Binary search rather than a scan: this runs on every timeupdate (~4Hz) against transcripts of
 * 2,300+ segments, and a linear scan there is the difference between smooth follow-along and a
 * page that stutters while the audio plays.
 *
 * A time inside a gap between segments returns the segment just before it, so the transcript
 * keeps the last spoken line highlighted through a pause rather than flickering to nothing.
 */
export function segmentIndexAt(segments: TranscriptSegment[], seconds: number): number {
  if (segments.length === 0 || seconds < segments[0]!.startSec) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid]!.startSec <= seconds) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Snap an arbitrary time to the start of the segment containing it.
 *
 * Used by every citation and action-item jump: landing mid-sentence sounds broken, so we always
 * seek to where the line actually starts.
 */
export function snapToSegmentStart(segments: TranscriptSegment[], seconds: number): number {
  const i = segmentIndexAt(segments, seconds);
  return i < 0 ? 0 : segments[i]!.startSec;
}

/** Consecutive segments by one speaker, so the transcript reads as turns rather than fragments. */
export interface SpeakerBlock {
  speaker: number | null;
  startSec: number;
  endSec: number;
  segments: TranscriptSegment[];
}

export function groupBySpeaker(segments: TranscriptSegment[]): SpeakerBlock[] {
  const blocks: SpeakerBlock[] = [];
  for (const seg of segments) {
    const last = blocks[blocks.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.segments.push(seg);
      last.endSec = seg.endSec;
    } else {
      blocks.push({
        speaker: seg.speaker,
        startSec: seg.startSec,
        endSec: seg.endSec,
        segments: [seg],
      });
    }
  }
  return blocks;
}

/** Initials for an avatar chip. Handles single-word handles like "Honkeymagoo". */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
