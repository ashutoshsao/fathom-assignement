"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, groupBySpeaker } from "@/lib/time";
import type { Call } from "@/lib/types";
import { useActiveSegment, usePlayback } from "./playback";
import { SpeakerChip } from "./SpeakerChip";

/**
 * The transcript, following playback.
 *
 * Two behaviours matter here and both are easy to get wrong:
 *
 *  1. Following pauses when you scroll. Auto-scrolling someone away from the line they are
 *     reading is the fastest way to ruin this feature. Scroll away and following stops; a
 *     "Jump to current" button appears to opt back in.
 *  2. Lines are grouped into speaker turns. Whisper emits fragments — "All of the digital," then
 *     "over the sink probably isn't great," — and rendering one row per fragment reads as noise
 *     rather than as a conversation.
 */
export function Transcript({ call }: { call: Call }) {
  const store = usePlayback();
  const active = useActiveSegment(call.transcript);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const [following, setFollowing] = useState(true);
  const programmatic = useRef(false);

  const blocks = useMemo(() => groupBySpeaker(call.transcript), [call.transcript]);
  const speakers = useMemo(
    () => new Map(call.speakers.map((s) => [s.id, s])),
    [call.speakers],
  );

  useEffect(() => {
    if (!following || active < 0) return;
    const el = activeRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    // Let the smooth scroll settle before listening for "the user scrolled" again, otherwise our
    // own scrolling switches following off immediately.
    const t = setTimeout(() => {
      programmatic.current = false;
    }, 700);
    return () => clearTimeout(t);
  }, [active, following]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={() => {
          if (!programmatic.current && following) setFollowing(false);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-7 py-5"
      >
        {blocks.map((block, bi) => {
          const speaker = block.speaker === null ? null : speakers.get(block.speaker);
          return (
            <div key={bi} className="mb-5 flex gap-3">
              <div className="w-9 shrink-0 pt-0.5">
                <SpeakerChip speaker={speaker} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-ui font-medium text-text">
                    {speaker?.name ?? "Unattributed"}
                  </span>
                  <button
                    onClick={() => store.seek(block.startSec)}
                    className="font-mono text-[11px] text-text-faint transition-colors hover:text-accent"
                  >
                    {formatTime(block.startSec)}
                  </button>
                </div>
                <p className="max-w-[640px] text-body leading-[var(--lh-read)] text-text-muted">
                  {block.segments.map((seg) => {
                    const isActive = call.transcript[active]?.id === seg.id;
                    return (
                      <span
                        key={seg.id}
                        ref={isActive ? activeRef : undefined}
                        onClick={() => store.seek(seg.startSec)}
                        className={`cursor-pointer rounded px-0.5 transition-colors ${
                          isActive
                            ? "bg-accent-quiet text-text"
                            : "hover:bg-surface-2 hover:text-text"
                        }`}
                        title={`Play from ${formatTime(seg.startSec)}`}
                      >
                        {seg.text}{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!following && (
        <button
          onClick={() => setFollowing(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-line-strong bg-surface-3 px-3 py-1.5 text-xs text-text shadow-lg transition-colors hover:border-accent hover:text-accent"
        >
          Jump to current
        </button>
      )}
    </div>
  );
}
