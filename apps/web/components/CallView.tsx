"use client";

import Link from "next/link";
import { useState } from "react";
import { clockTime, dayLabel, resolveDate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { Call } from "@/lib/types";
import { ActionItems } from "./ActionItems";
import { AskPanel } from "./AskPanel";
import { PlaybackProvider } from "./playback";
import { Player } from "./Player";
import { SpeakerChip } from "./SpeakerChip";
import { SummaryPane } from "./SummaryPane";
import { Transcript } from "./Transcript";
import { SUGGESTED_SINGLE } from "@/lib/ask-suggestions";

type Tab = "summary" | "actions" | "transcript";

export function CallView({ call, startAt }: { call: Call; startAt?: number }) {
  const [tab, setTab] = useState<Tab>("summary");
  const date = resolveDate(call.daysAgo, call.timeOfDay);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "summary", label: "Summary" },
    { id: "actions", label: "Action Items", count: call.actionItems.length },
    { id: "transcript", label: "Transcript" },
  ];

  return (
    <PlaybackProvider src={call.audioUrl} startAt={startAt}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-line px-5 py-3">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-text-faint transition-colors hover:text-text"
          >
            <span aria-hidden>←</span> Back to My Calls
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[19px] font-semibold text-text">{call.title}</h1>
            <span className="text-[13px] text-text-faint">
              {dayLabel(date)} · {clockTime(date)} · {formatDuration(call.durationSec)}
            </span>
            <div className="ml-auto flex -space-x-1.5">
              {call.speakers.slice(0, 8).map((s) => (
                <SpeakerChip key={s.id} speaker={s} size={24} />
              ))}
              {call.speakers.length > 8 && (
                <span className="flex h-6 items-center pl-3 text-[12px] text-text-faint">
                  +{call.speakers.length - 8}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="flex min-h-0 flex-1 flex-col border-line lg:border-r">
            <nav className="flex shrink-0 gap-1 border-b border-line px-5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
                    tab === t.id
                      ? "border-accent text-accent"
                      : "border-transparent text-text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className="ml-1.5 rounded bg-surface-3 px-1.5 py-px text-[11px] text-text-muted">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Rendered only when selected. Leaving an empty flex-1 container mounted stole
                half the height from the transcript and left a large blank gap above it. */}
            {tab !== "transcript" && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "summary" && <SummaryPane call={call} />}
                {tab === "actions" && <ActionItems call={call} />}
              </div>
            )}
            {/* Kept mounted so scroll position and follow-state survive tab switches. */}
            <div className={tab === "transcript" ? "flex min-h-0 flex-1" : "hidden"}>
              <Transcript call={call} />
            </div>
          </main>

          <aside className="flex shrink-0 flex-col lg:w-[380px]">
            <Player peaks={call.waveform} />
            <AskPanel callId={call.id} suggestions={SUGGESTED_SINGLE} scopeLabel="This call" />
            <div className="shrink-0 border-t border-line px-5 py-3">
              <p className="text-[11px] leading-relaxed text-text-faint">
                Audio: {call.source.name} —{" "}
                <a
                  href={call.source.url}
                  className="underline decoration-dotted hover:text-text-muted"
                  target="_blank"
                  rel="noreferrer"
                >
                  original
                </a>
                , {call.source.license}. Speaker labels added by us.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </PlaybackProvider>
  );
}
