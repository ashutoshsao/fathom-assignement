import { generateJson, uploadAudio } from "@/lib/gemini";

export const maxDuration = 300;

/**
 * A real recording → a real call record.
 *
 * Same two-pass shape the seed data went through: audio becomes a diarized, timestamped
 * transcript, then the transcript becomes notes. Reusing the proven passes rather than inventing
 * a combined schema, because the seed pipeline already taught us where these fail.
 *
 * The one difference from seeded calls: there is no Whisper pass here, so timestamps come from
 * the model. On long audio those drift badly (a 35-minute slice once returned turns at 57
 * minutes), which is exactly why recordings are meant to be short — the UI says so.
 */

const TRANSCRIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    speakers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          name: { type: "STRING", description: "Name if spoken aloud, else 'Speaker 1' etc" },
        },
        required: ["id", "name"],
      },
    },
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startSec: { type: "NUMBER" },
          endSec: { type: "NUMBER" },
          speaker: { type: "INTEGER" },
          text: { type: "STRING" },
        },
        required: ["startSec", "endSec", "speaker", "text"],
      },
    },
  },
  required: ["speakers", "segments"],
} as const;

const NOTES_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short meeting title, 2-6 words" },
    blurb: { type: "STRING", description: "One sentence for the library card" },
    purpose: { type: "STRING" },
    keyTakeaways: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { point: { type: "STRING" }, segmentIndex: { type: "INTEGER" } },
        required: ["point", "segmentIndex"],
      },
    },
    topics: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          points: { type: "ARRAY", items: { type: "STRING" } },
          segmentIndex: { type: "INTEGER" },
        },
        required: ["heading", "points", "segmentIndex"],
      },
    },
    actionItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          assignee: { type: "STRING" },
          segmentIndex: { type: "INTEGER" },
        },
        required: ["text", "assignee", "segmentIndex"],
      },
    },
    nextSteps: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "blurb", "purpose", "keyTakeaways", "topics", "actionItems", "nextSteps"],
} as const;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return Response.json({ error: "audio file is required" }, { status: 400 });
    }
    if (file.size < 2000) {
      return Response.json(
        { error: "That recording is too short to transcribe. Try at least a few seconds." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const uri = await uploadAudio(bytes, file.type || "audio/webm");

    const transcript = await generateJson<{
      speakers: { id: number; name: string }[];
      segments: { startSec: number; endSec: number; speaker: number; text: string }[];
    }>({
      parts: [
        {
          text: `Transcribe this meeting recording.

- Split into short segments at natural pauses, each with start and end time in seconds from the
  start of the audio.
- Attribute every segment to a speaker. Use the person's name if it is spoken aloud in the
  recording, otherwise "Speaker 1", "Speaker 2" and so on.
- Transcribe what is actually said, including false starts. Do not tidy the conversation up.
- If the audio contains no intelligible speech, return empty arrays.`,
        },
        { file_data: { mime_type: file.type || "audio/webm", file_uri: uri } },
      ],
      schema: TRANSCRIPT_SCHEMA,
      thinking: 2048,
    });

    if (!transcript.segments?.length) {
      return Response.json(
        { error: "No speech was detected in that recording." },
        { status: 422 },
      );
    }

    const names = new Map(transcript.speakers.map((s) => [s.id, s.name]));
    const lines = transcript.segments
      .map((s, i) => `${i}  ${names.get(s.speaker) ?? "Unknown"}: ${s.text}`)
      .join("\n");

    const notes = await generateJson<Record<string, never>>({
      parts: [
        {
          text: `Below is the transcript of a recorded meeting, as numbered segments.

Write the meeting notes a good notetaker would leave. Every structured item carries the
segmentIndex it is drawn from, so a reader can jump to the moment.

- actionItems: only genuine commitments. If nobody committed to anything, return an empty list.
- Write plainly. No filler, no "the team discussed".

Speakers: ${[...names.values()].join(", ")}

Transcript:
${lines}`,
        },
      ],
      schema: NOTES_SCHEMA,
      thinking: 2048,
      temperature: 0.3,
    });

    return Response.json({ transcript, notes });
  } catch (err) {
    const quota = err instanceof Error && err.name === "QuotaExhaustedError";
    const message = err instanceof Error ? err.message : "transcription failed";
    return Response.json({ error: message, kind: quota ? "quota" : "failure" },
                         { status: quota ? 429 : 500 });
  }
}
