"use client";

import Link from "next/link";
import { PlaybackProvider } from "./playback";
import { Player } from "./Player";
import { formatDuration } from "@/lib/time";
import type { Call } from "@/lib/types";

/**
 * A recording that exists but has not been transcribed yet.
 *
 * Deliberately not a spinner on an empty page: the audio is already on disk, so it plays. The
 * user gets their recording back instantly and the notes catch up — the same order the real
 * product does it in.
 */
export function ProcessingCall({ call }: { call: Call }) {
  const failed = call.status === "failed";

  return (
    <PlaybackProvider src={call.audioUrl}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-line px-5 py-3">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-text-faint transition-colors hover:text-text"
          >
            <span aria-hidden>←</span> Back to My Calls
          </Link>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[19px] font-semibold text-text">{call.title}</h1>
            <span className="text-[13px] text-text-faint">
              Just now · {formatDuration(call.durationSec)}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            {failed ? (
              <>
                <p className="text-[14px] text-text">Could not transcribe this recording.</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#f2836b]">{call.error}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-text-faint">
                  The recording itself is safe and still plays below.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center justify-center gap-2 text-[14px] text-text">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Transcribing and writing the notes…
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-text-faint">
                  Your recording is already saved and plays right now. The transcript, summary and
                  action items will appear here when they are ready — you can leave this page.
                </p>
              </>
            )}
          </div>
        </div>

        <Player peaks={call.waveform} />
      </div>
    </PlaybackProvider>
  );
}
