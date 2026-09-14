"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onProcessingChange, resumeIfInterrupted } from "@/lib/processing";
import { deleteRecording, listRecordings } from "@/lib/recordings-store";
import { formatDuration } from "@/lib/time";
import type { Call } from "@/lib/types";
import { SpeakerChip } from "./SpeakerChip";

/**
 * Recordings made in this browser, shown above the seeded library.
 *
 * Marked as local rather than blended in silently: they genuinely behave differently (nobody else
 * can see them, and clearing site data loses them), and a reviewer should be able to tell which
 * calls came with the demo and which one they just made themselves.
 */
export function LocalRecordings() {
  const [calls, setCalls] = useState<Omit<Call, "audioUrl">[]>([]);

  useEffect(() => {
    const load = () =>
      void listRecordings().then((all) => {
        setCalls(all);
        for (const c of all) if (c.status === "processing") void resumeIfInterrupted(c.id);
      });
    load();
    return onProcessingChange(load);
  }, []);

  if (calls.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-muted">
        Recorded in this browser
        <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-normal text-text-faint">
          only visible to you
        </span>
      </h2>
      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="group flex items-center gap-4 rounded-card border border-accent/25 bg-surface p-3.5 transition-colors hover:border-accent/50"
          >
            <Link href={`/recordings/${call.id}`} className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-medium text-text group-hover:text-accent">
                {call.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-muted">
                {call.status === "failed" ? "Transcription failed — the audio still plays" : call.blurb}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <div className="flex -space-x-1.5">
                  {call.speakers.slice(0, 6).map((s) => (
                    <SpeakerChip key={s.id} speaker={s} size={20} />
                  ))}
                </div>
                <span className="flex items-center gap-1.5 text-[12px] text-text-faint">
                  {call.status === "processing" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  )}
                  {formatDuration(call.durationSec)} · recorded just now
                </span>
              </div>
            </Link>
            <button
              onClick={async () => {
                await deleteRecording(call.id);
                setCalls((c) => c.filter((x) => x.id !== call.id));
              }}
              className="shrink-0 rounded px-2 py-1 text-[12px] text-text-faint transition-colors hover:bg-surface-2 hover:text-[#f2836b]"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
