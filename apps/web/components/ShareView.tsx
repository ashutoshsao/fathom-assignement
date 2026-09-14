"use client";

import { useState } from "react";
import { clockTime, dayLabel, resolveDate } from "@/lib/dates";
import { formatDuration, formatTime, groupBySpeaker } from "@/lib/time";
import type { Call } from "@/lib/types";
import { PlaybackProvider, usePlayback } from "./playback";
import { Player } from "./Player";
import { SpeakerChip } from "./SpeakerChip";
import { SummaryPane } from "./SummaryPane";

/**
 * The public view of a call.
 *
 * Deliberately reduced. A shared link is for somebody who was not on the call and does not have
 * an account: they get the recording, what was said, and what it meant. They do not get the
 * owner's other meetings, their settings, or a search box across a library that is not theirs.
 *
 * Nothing here is gated, because nothing in this product is gated — which is also what makes the
 * brief's "the live link opens for somebody who is not signed in" true by construction.
 */
export function ShareView({ call, clip }: { call: Call; clip?: { startSec: number; endSec: number } }) {
  const date = resolveDate(call.daysAgo, call.timeOfDay);

  const visible = clip
    ? call.transcript.filter((s) => s.endSec > clip.startSec && s.startSec < clip.endSec)
    : call.transcript;

  return (
    <PlaybackProvider src={call.audioUrl} clip={clip}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line px-5 py-3.5">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[13px] font-semibold tracking-tight text-text-faint">FATHOM</span>
            <h1 className="text-[18px] font-semibold text-text">{call.title}</h1>
            <span className="text-[13px] text-text-faint">
              {dayLabel(date)} · {clockTime(date)} ·{" "}
              {clip
                ? `clip · ${formatTime(clip.startSec)}–${formatTime(clip.endSec)}`
                : formatDuration(call.durationSec)}
            </span>
            <div className="ml-auto flex -space-x-1.5">
              {call.speakers.slice(0, 6).map((s) => (
                <SpeakerChip key={s.id} speaker={s} size={22} />
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl">
            {clip ? <ClipTranscript call={call} segments={visible} /> : <Tabs call={call} />}
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl shrink-0">
          <Player peaks={call.waveform} />
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-text-faint">
            Shared from Fathom · Audio: {call.source.name}
            {call.source.url && (
              <>
                {" — "}
                <a href={call.source.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                  original
                </a>
              </>
            )}
            {call.source.license ? `, ${call.source.license}` : ""}
          </p>
        </div>
      </div>
    </PlaybackProvider>
  );
}

function Tabs({ call }: { call: Call }) {
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  return (
    <>
      <nav className="flex gap-1 border-b border-line px-5">
        {(["summary", "transcript"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] capitalize transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "summary" ? (
        <SummaryPane call={call} />
      ) : (
        <ClipTranscript call={call} segments={call.transcript} />
      )}
    </>
  );
}

function ClipTranscript({
  call,
  segments,
}: {
  call: Call;
  segments: Call["transcript"];
}) {
  const store = usePlayback();
  const speakers = new Map(call.speakers.map((s) => [s.id, s]));
  const blocks = groupBySpeaker(segments);

  return (
    <div className="px-5 py-5">
      {blocks.map((block, i) => {
        const speaker = block.speaker === null ? null : speakers.get(block.speaker);
        return (
          <div key={i} className="mb-5 flex gap-3">
            <div className="w-9 shrink-0 pt-0.5">
              <SpeakerChip speaker={speaker} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-text">
                  {speaker?.name ?? "Unattributed"}
                </span>
                <button
                  onClick={() => store.seek(block.startSec)}
                  className="font-mono text-[11px] text-text-faint transition-colors hover:text-accent"
                >
                  {formatTime(block.startSec)}
                </button>
              </div>
              <p className="text-[14px] leading-relaxed text-text-muted">
                {block.segments.map((seg) => (
                  <span
                    key={seg.id}
                    onClick={() => store.seek(seg.startSec)}
                    className="cursor-pointer rounded px-0.5 hover:bg-surface-2 hover:text-text"
                  >
                    {seg.text}{" "}
                  </span>
                ))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
