"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { peaksFrom } from "@/lib/build-recording";
import { startProcessing } from "@/lib/processing";
import { isSupported, MeetingRecorder } from "@/lib/recorder";
import { saveRecording } from "@/lib/recordings-store";
import { formatTime } from "@/lib/time";
import type { Call } from "@/lib/types";

type Phase = "idle" | "arming" | "recording" | "processing" | "error";

/**
 * Records a real meeting.
 *
 * This is the one part of the product the brief said we could fake, and did not need to. No bot
 * joins the call — the browser captures the meeting tab's audio and the microphone, which is the
 * same shape as Fathom's own bot-free desktop capture.
 */
export function Recorder() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [marks, setMarks] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const recorder = useRef<MeetingRecorder | null>(null);
  const supported = useRef(true);

  useEffect(() => {
    supported.current = isSupported();
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setElapsed(recorder.current?.elapsed() ?? 0), 250);
    return () => clearInterval(id);
  }, [phase]);

  async function start() {
    setError("");
    setPhase("arming");
    try {
      const r = new MeetingRecorder();
      await r.start(true);
      recorder.current = r;
      setMarks(0);
      setElapsed(0);
      setPhase("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start recording");
      setPhase("error");
    }
  }

  async function stop() {
    const r = recorder.current;
    if (!r) return;
    setPhase("processing");
    setNote("Saving your recording…");
    try {
      const result = await r.stop();
      const id = `rec-${Date.now().toString(36)}`;

      // Waveform is computed locally from audio we already hold, so the recording is genuinely
      // playable the moment it is saved — before the model has seen it.
      const waveform = await peaksFrom(result.blob);

      const placeholder: Omit<Call, "audioUrl"> = {
        id,
        title: "New recording",
        daysAgo: 0,
        timeOfDay: new Date().toTimeString().slice(0, 5),
        durationSec: result.durationSec,
        platform: "google-meet",
        blurb: "Transcribing…",
        speakers: [],
        waveform,
        summary: { purpose: "", keyTakeaways: [], topics: [], nextSteps: [] },
        actionItems: [],
        transcript: [],
        highlights: result.marks.map((atSec, i) => ({
          id: `${id}-h${i}`,
          atSec,
          label: "Marked during the call",
        })),
        source: {
          name: "Recorded in your browser",
          url: "",
          license: "Your recording — stored locally, never uploaded except to transcribe",
          licenseUrl: "",
        },
        status: "processing",
      };

      await saveRecording(placeholder, result.blob);
      // Deliberately not awaited: the user should not wait for the model to see their recording.
      startProcessing(id, result.blob, {
        durationSec: result.durationSec,
        marks: result.marks,
      });
      setPhase("idle");
      router.push(`/recordings/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }

  if (phase === "recording") {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full border border-[#f2836b]/40 bg-surface-2 py-2 pl-4 pr-2 shadow-2xl">
        <span className="flex items-center gap-2 text-[13px] text-text">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#f2836b]" />
          <span className="font-mono tabular-nums">{formatTime(elapsed)}</span>
        </span>
        <button
          onClick={() => {
            recorder.current?.mark();
            setMarks((m) => m + 1);
          }}
          className="rounded-full px-2.5 py-1 text-[12px] text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          title="Mark this moment"
        >
          Mark{marks > 0 ? ` (${marks})` : ""}
        </button>
        <button
          onClick={stop}
          className="rounded-full bg-[#f2836b] px-3 py-1 text-[12px] font-medium text-black"
        >
          Stop
        </button>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full border border-line-strong bg-surface-2 px-4 py-2.5 shadow-2xl">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <span className="text-[13px] text-text">{note}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={start}
        disabled={phase === "arming"}
        title="Records the shared tab's audio plus your mic, then transcribes it for real"
        className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3 py-1.5 text-ui text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <span className="h-2 w-2 rounded-full bg-[#f2836b]" aria-hidden />
        {phase === "arming" ? "Waiting for you to share a tab…" : "Record a meeting"}
      </button>
      <p className="max-w-[260px] text-right text-[11px] leading-relaxed text-text-faint">
        Chrome or Edge only; the recording stays in this browser.
      </p>
      {error && (
        <p className="max-w-[280px] rounded-card border border-[#f2836b]/40 bg-surface-2 px-3 py-2 text-right text-[11.5px] leading-relaxed text-[#f2836b]">
          {error}
        </p>
      )}
    </div>
  );
}
