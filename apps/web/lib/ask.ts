import "server-only";

import type { Call } from "./types";

/**
 * Ask: answering questions from the transcript, with citations that can be proved.
 *
 * No vector retrieval. Measured: the largest call is ~24k tokens and the whole five-call library
 * is ~71k — 6.8% of one context window. Chunk retrieval here would cost accuracy on exactly the
 * questions that matter ("what might fall through the cracks?" is a whole-meeting question, not a
 * lookup) and would fail silently, producing a confident answer with a citation that does not
 * support it. See specs/2-ask.md.
 *
 * Citations are segment ids, not timestamps the model writes. The model can only pick from ids it
 * was given, so a citation cannot point at a moment that does not exist — the same grounding rule
 * the diarization pipeline arrived at the hard way.
 */

export const ASK_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: {
      type: "STRING",
      description:
        "The answer, in plain prose. Two or three short paragraphs at most. No markdown headings.",
    },
    citations: {
      type: "ARRAY",
      description: "The moments that support the answer. Between 1 and 4, most relevant first.",
      items: {
        type: "OBJECT",
        properties: {
          callId: { type: "STRING" },
          segmentId: { type: "INTEGER" },
          label: {
            type: "STRING",
            description:
              "A SHORT DESCRIPTION of what happens at this moment, 4-8 words, written by you. " +
              "Never quote the transcript verbatim. Example: 'Ken agrees to update the show notes'.",
          },
        },
        required: ["callId", "segmentId", "label"],
      },
    },
  },
  // answer first so it can be streamed while the citations are still being written
  propertyOrdering: ["answer", "citations"],
  required: ["answer", "citations"],
} as const;

function transcriptFor(call: Call): string {
  const names = new Map(call.speakers.map((s) => [s.id, s.name]));
  const lines = call.transcript
    .map((s) => `${s.id}|${names.get(s.speaker ?? -1) ?? "Unknown"}: ${s.text}`)
    .join("\n");
  return `### CALL ${call.id} — "${call.title}"\n${lines}`;
}

export function buildPrompt(calls: Call[], question: string, scoped: boolean): string {
  const body = calls.map(transcriptFor).join("\n\n");
  const scopeNote = scoped
    ? "You are answering about this one call."
    : `You are answering across ${calls.length} calls from the same recurring meeting series. ` +
      "Say which call something came from when it matters, and prefer the most recent when they conflict.";

  return `You are answering questions about recorded meetings, from the transcripts below.

${scopeNote}

Each line is: segmentId|Speaker: text

Rules:
- Answer only from what is actually said. If the transcripts do not contain the answer, say so
  plainly — do not reach for something adjacent and present it as the answer.
- Every citation must be a segmentId that appears above, with its matching callId. Cite the
  moment the point is actually made, not where it is recapped.
- Citation labels are your own short description of the moment (4-8 words), not a quote lifted
  from the transcript. A chip is a signpost, not an excerpt.
- These are real conversations: people ramble, misspeak and talk over each other. Read past that
  to what they meant.
- Be direct and specific. No "the team discussed", no restating the question back.

Question: ${question}

Transcripts:
${body}`;
}

export interface ResolvedCitation {
  callId: string;
  callTitle: string;
  atSec: number;
  label: string;
}

/**
 * Turn model-chosen segment ids into real timestamps, dropping anything that does not exist.
 *
 * This is the guard that makes a citation chip trustworthy: an id the model invented resolves to
 * nothing and is discarded, rather than seeking the player to a fabricated moment.
 */
export function resolveCitations(
  calls: Call[],
  raw: { callId: string; segmentId: number; label: string }[],
): ResolvedCitation[] {
  const byId = new Map(calls.map((c) => [c.id, c]));
  const out: ResolvedCitation[] = [];
  const seen = new Set<string>();

  for (const c of raw ?? []) {
    const call = byId.get(c.callId) ?? (calls.length === 1 ? calls[0] : undefined);
    if (!call) continue;
    const seg = call.transcript.find((s) => s.id === c.segmentId);
    if (!seg) continue;
    const key = `${call.id}:${seg.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      callId: call.id,
      callTitle: call.title,
      atSec: seg.startSec,
      label: c.label,
    });
  }
  return out.slice(0, 4);
}

export const SUGGESTED_SINGLE = [
  "What was decided?",
  "What might fall through the cracks?",
  "Summarise this call in three lines",
];

export const SUGGESTED_ALL = [
  "What keeps coming up across these meetings?",
  "What was mentioned as urgent?",
  "What is still unresolved?",
];
