/**
 * The data model.
 *
 * Everything in this product resolves to one thing: a position on the call's timeline, in
 * seconds. The player, the transcript, action items, highlights and every Ask citation all
 * address that same spine. Get it right once and click-to-seek, scroll-sync, citation-jump
 * and clip-sharing all fall out of it for free.
 */

export type Platform = "google-meet" | "zoom" | "teams";

export interface Speaker {
  id: number;
  /** Real name where one is actually spoken in the call, else "Speaker 3". */
  name: string;
  initials: string;
  /** Index into the palette in lib/speakers.ts — stable per call. */
  colorIndex: number;
  /** How the voice was described during diarization. Kept for provenance, not shown. */
  voice?: string;
}

export interface TranscriptSegment {
  id: number;
  startSec: number;
  endSec: number;
  text: string;
  /** Speaker.id, or null where diarization could not attribute the line. */
  speaker: number | null;
}

/** A point anchored to the moment in the call it was drawn from. */
export interface AnchoredPoint {
  point: string;
  atSec: number;
}

export interface SummaryTopic {
  heading: string;
  points: string[];
  atSec: number;
}

export interface Summary {
  purpose: string;
  /**
   * Anchored, not plain strings: a takeaway you cannot jump to is one you have to re-listen to
   * the whole call to verify.
   */
  keyTakeaways: AnchoredPoint[];
  topics: SummaryTopic[];
  nextSteps: string[];
}

export interface ActionItem {
  id: string;
  text: string;
  /** Speaker.id this was assigned to, or null where the call does not make it clear. */
  assignee: number | null;
  /** Where in the call it came from — clicking it seeks here. */
  atSec: number;
}

export interface Highlight {
  id: string;
  atSec: number;
  label: string;
}

export interface Call {
  id: string;
  title: string;
  /**
   * Recency, not a fixed date. Resolved against "now" at render time (see lib/dates.ts) so the
   * seeded library always reads as a live account instead of decaying into stale dates.
   */
  daysAgo: number;
  /** "15:30" — the wall-clock time the meeting started. */
  timeOfDay: string;
  durationSec: number;
  platform: Platform;
  /** One-line AI summary shown on the library card. */
  blurb: string;
  speakers: Speaker[];
  /** Pre-computed peaks for the waveform, 0..1. */
  waveform: number[];
  audioUrl: string;
  summary: Summary;
  actionItems: ActionItem[];
  transcript: TranscriptSegment[];
  highlights: Highlight[];
  /** Attribution, since the audio is CC BY-SA and the licence requires it travel with the work. */
  source: { name: string; url: string; license: string; licenseUrl: string };
}

/** What the library list needs — everything except the heavy transcript. */
export type CallSummaryCard = Omit<Call, "transcript" | "summary" | "actionItems" | "highlights">;

/** A citation Ask returns: an answer is only as good as its ability to prove itself. */
export interface Citation {
  callId: string;
  atSec: number;
  label: string;
}

export interface AskAnswer {
  answer: string;
  citations: Citation[];
}
