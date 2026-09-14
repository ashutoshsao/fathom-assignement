import "server-only";

import { getAllCalls } from "./seed";
import type { Call } from "./types";

/**
 * Search across what was said, not just call titles.
 *
 * "Which call was that in?" is the question people actually have, and a title match cannot
 * answer it — our five calls are titled almost identically on purpose (they are the same
 * recurring meeting), so title search would be useless here by construction.
 *
 * Server-side: the transcripts are ~55k words. Filtering in the browser would mean downloading
 * every call before you could search one.
 */

export interface SearchHit {
  callId: string;
  callTitle: string;
  daysAgo: number;
  atSec: number;
  speaker: string | null;
  /** The matching line plus its neighbours, so a hit reads as a sentence not a fragment. */
  excerpt: string;
  /** Character offsets of the match inside `excerpt`, for highlighting. */
  match: [number, number];
}

export async function searchCalls(query: string, limit = 24): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const calls = await getAllCalls();
  const hits: SearchHit[] = [];

  for (const call of calls) {
    const names = new Map(call.speakers.map((s) => [s.id, s.name]));
    const segs = call.transcript;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      const idx = seg.text.toLowerCase().indexOf(q);
      if (idx === -1) continue;

      // Whisper segments are often a few words long; neighbours make the hit readable.
      const before = segs[i - 1]?.text ?? "";
      const after = segs[i + 1]?.text ?? "";
      const prefix = before ? before + " " : "";
      const excerpt = `${prefix}${seg.text} ${after}`.trim();

      hits.push({
        callId: call.id,
        callTitle: call.title,
        daysAgo: call.daysAgo,
        atSec: seg.startSec,
        speaker: seg.speaker === null ? null : (names.get(seg.speaker) ?? null),
        excerpt,
        match: [prefix.length + idx, prefix.length + idx + q.length],
      });

      if (hits.length >= limit * 4) break;
    }
  }

  // Most recent call first — in a recurring series, "what did we say about X" usually means
  // the last time we said it.
  hits.sort((a, b) => a.daysAgo - b.daysAgo || a.atSec - b.atSec);
  return hits.slice(0, limit);
}

export function countHits(calls: Call[], query: string): number {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return 0;
  let n = 0;
  for (const c of calls) for (const s of c.transcript) if (s.text.toLowerCase().includes(q)) n++;
  return n;
}
