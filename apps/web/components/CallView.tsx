"use client";

import Link from "next/link";
import { useState } from "react";
import { clockTime, dayLabel, resolveDate } from "@/lib/dates";

const PLATFORM: Record<string, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

/** The separator between metadata facts — a dot reads quieter than a pipe or a slash. */
function Dot() {
  return <span className="h-[3px] w-[3px] rounded-full bg-line-strong" aria-hidden />;
}
import { formatDuration } from "@/lib/time";
import type { Call } from "@/lib/types";
import { ActionItems } from "./ActionItems";
import { AskPanel } from "./AskPanel";
import { PlaybackProvider } from "./playback";
import { Player } from "./Player";
import { ShareMenu } from "./ShareMenu";
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
    <PlaybackProvider src={call.audioUrl} durationHint={call.durationSec} startAt={startAt}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 px-7 pb-3.5 pt-4">
          <Link
            href="/"
            className="mb-2.5 inline-flex items-center gap-1.5 text-meta text-text-faint transition-colors hover:text-text"
          >
            <span aria-hidden>←</span> My Calls
          </Link>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-display font-semibold leading-tight tracking-[-0.022em] text-text">
                {call.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-meta text-text-muted">
                <span>
                  {dayLabel(date)}, {clockTime(date)}
                </span>
                <Dot />
                <span>{formatDuration(call.durationSec)}</span>
                <Dot />
                <span>{PLATFORM[call.platform] ?? call.platform}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3.5">
              <div className="flex -space-x-1.5">
                {call.speakers.slice(0, 6).map((s) => (
                  <SpeakerChip key={s.id} speaker={s} size={26} ring />
                ))}
                {call.speakers.length > 6 && (
                  <span className="z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-bg bg-surface-2 text-[9.5px] text-text-muted">
                    +{call.speakers.length - 6}
                  </span>
                )}
              </div>
              {!call.id.startsWith("rec-") && (
                <ShareMenu callId={call.id} durationSec={call.durationSec} />
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="flex min-h-0 flex-1 flex-col border-line lg:border-r">
            <nav className="flex shrink-0 gap-5 border-b border-line px-7 pt-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 pt-0.5 text-ui transition-colors ${
                    tab === t.id
                      ? "border-accent font-medium text-accent"
                      : "border-transparent text-text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className="rounded bg-surface-3 px-1.5 py-px text-[10.5px] text-text-muted">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Rendered only when selected. Leaving an empty flex-1 container mounted stole
                half the height from the transcript and left a large blank gap above it. */}
            {tab !== "transcript" && (
              <div key={tab} className="rise min-h-0 flex-1 overflow-y-auto">
                {tab === "summary" && <SummaryPane call={call} />}
                {tab === "actions" && <ActionItems call={call} />}
              </div>
            )}
            {/* Kept mounted so scroll position and follow-state survive tab switches. */}
            <div className={tab === "transcript" ? "flex min-h-0 flex-1" : "hidden"}>
              <Transcript call={call} />
            </div>
          </main>

          <aside className="flex shrink-0 flex-col bg-[#0d0d10] lg:w-[400px]">
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
