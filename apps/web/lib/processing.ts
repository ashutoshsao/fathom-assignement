"use client";

import { buildRecordedCall } from "./build-recording";
import { loadRecording, saveRecording } from "./recordings-store";
import type { Call } from "./types";

/**
 * Transcription that outlives the component that started it.
 *
 * Stopping a recording used to block the user on a 30-60s round-trip for audio they already had.
 * Now the recording is saved and shown immediately, and this finishes the job in the background —
 * which is also how the real product behaves, its summary arriving after you have left the call.
 *
 * Module-level, deliberately: a client-side navigation unmounts the recorder, and a fetch owned by
 * that component would be abandoned mid-flight. This survives because it is not owned by any
 * component at all.
 */

type Listener = (id: string) => void;

const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<Listener>();

export function onProcessingChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce(id: string) {
  for (const fn of listeners) fn(id);
}

export function isProcessing(id: string): boolean {
  return inFlight.has(id);
}

export function startProcessing(
  id: string,
  audio: Blob,
  meta: { durationSec: number; marks: number[] },
): void {
  if (inFlight.has(id)) return;

  const job = (async () => {
    try {
      const form = new FormData();
      form.append("audio", audio, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");

      const existing = await loadRecording(id);
      const call = buildRecordedCall({
        id,
        transcript: data.transcript,
        notes: data.notes,
        durationSec: meta.durationSec,
        waveform: existing?.waveform ?? [],
        marks: meta.marks,
      });
      if (existing?.audioUrl) URL.revokeObjectURL(existing.audioUrl);
      await saveRecording({ ...call, status: "ready" }, audio);
    } catch (err) {
      const existing = await loadRecording(id);
      if (existing) {
        if (existing.audioUrl) URL.revokeObjectURL(existing.audioUrl);
        const { audioUrl: _drop, ...rest } = existing;
        await saveRecording(
          {
            ...rest,
            status: "failed",
            error: err instanceof Error ? err.message : "Transcription failed",
          } as Omit<Call, "audioUrl">,
          audio,
        );
      }
    } finally {
      inFlight.delete(id);
      announce(id);
    }
  })();

  inFlight.set(id, job);
  announce(id);
}
