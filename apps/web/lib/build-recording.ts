import type { Call, Speaker, TranscriptSegment } from "./types";
import { initialsFor } from "./time";

interface RawTranscript {
  speakers: { id: number; name: string }[];
  segments: { startSec: number; endSec: number; speaker: number; text: string }[];
}

interface RawNotes {
  title: string;
  blurb: string;
  purpose: string;
  keyTakeaways: { point: string; segmentIndex: number }[];
  topics: { heading: string; points: string[]; segmentIndex: number }[];
  actionItems: { text: string; assignee: string; segmentIndex: number }[];
  nextSteps: string[];
}

/** Peaks for the scrubber, decoded once from the recording we already hold in memory. */
export async function peaksFrom(blob: Blob, buckets = 420): Promise<number[]> {
  try {
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = audio.getChannelData(0);
    void ctx.close();

    const size = Math.max(1, Math.floor(data.length / buckets));
    const rms: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let sum = 0;
      const start = i * size;
      const end = Math.min(data.length, start + size);
      if (start >= end) break;
      for (let j = start; j < end; j++) sum += data[j]! * data[j]!;
      rms.push(Math.sqrt(sum / (end - start)));
    }
    if (rms.length === 0) return [];

    // Same percentile stretch as the seed pipeline: normalising against the max gives a flat bar
    // chart, because speech has a narrow RMS range.
    const ranked = [...rms].sort((a, b) => a - b);
    const lo = ranked[Math.floor(ranked.length * 0.05)] ?? 0;
    const hi = ranked[Math.floor(ranked.length * 0.95)] ?? 1;
    const span = hi - lo || 1;
    return rms.map((v) => Number(Math.min(1, Math.max(0.06, (v - lo) / span)).toFixed(3)));
  } catch {
    return [];
  }
}

export function buildRecordedCall(args: {
  id: string;
  transcript: RawTranscript;
  notes: RawNotes;
  durationSec: number;
  waveform: number[];
  marks: number[];
}): Omit<Call, "audioUrl"> {
  const { transcript, notes } = args;

  const speakers: Speaker[] = transcript.speakers.map((s, i) => ({
    id: s.id,
    name: s.name,
    initials: initialsFor(s.name),
    colorIndex: i % 8,
  }));

  const segments: TranscriptSegment[] = transcript.segments.map((s, i) => ({
    id: i,
    startSec: s.startSec,
    endSec: s.endSec,
    text: s.text,
    speaker: speakers.some((sp) => sp.id === s.speaker) ? s.speaker : null,
  }));

  // Resolve every model-chosen index to a real timestamp, dropping ones that do not exist — the
  // same guard the seed pipeline and Ask citations use.
  const at = (i: number) => segments[i]?.startSec ?? 0;
  const byName = new Map(speakers.map((s) => [s.name.toLowerCase(), s.id]));

  return {
    id: args.id,
    title: notes.title,
    daysAgo: 0,
    timeOfDay: new Date().toTimeString().slice(0, 5),
    durationSec: args.durationSec,
    platform: "google-meet",
    blurb: notes.blurb,
    speakers,
    waveform: args.waveform,
    summary: {
      purpose: notes.purpose,
      keyTakeaways: notes.keyTakeaways.map((k) => ({ point: k.point, atSec: at(k.segmentIndex) })),
      topics: notes.topics.map((t) => ({
        heading: t.heading,
        points: t.points,
        atSec: at(t.segmentIndex),
      })),
      nextSteps: notes.nextSteps,
    },
    actionItems: notes.actionItems.map((a, i) => ({
      id: `${args.id}-a${i}`,
      text: a.text,
      assignee: byName.get((a.assignee ?? "").toLowerCase()) ?? null,
      atSec: at(a.segmentIndex),
    })),
    transcript: segments,
    highlights: args.marks.map((atSec, i) => ({
      id: `${args.id}-h${i}`,
      atSec,
      label: "Marked during the call",
    })),
    source: {
      name: "Recorded in your browser",
      url: "",
      license: "Your recording — stored locally, never uploaded except to transcribe",
      licenseUrl: "",
    },
  };
}
