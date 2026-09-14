import Link from "next/link";
import { clockTime, resolveDate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { CallSummaryCard } from "@/lib/types";
import { SpeakerChip } from "./SpeakerChip";

const PLATFORM_LABEL: Record<string, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

export function CallCard({ call }: { call: CallSummaryCard }) {
  const date = resolveDate(call.daysAgo, call.timeOfDay);
  return (
    <Link
      href={`/calls/${call.id}`}
      className="group flex gap-4 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <Thumb peaks={call.waveform} duration={call.durationSec} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-[15px] font-medium text-text group-hover:text-accent">
            {call.title}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-muted">
          {call.blurb}
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {call.speakers.slice(0, 6).map((s) => (
              <SpeakerChip key={s.id} speaker={s} size={20} />
            ))}
            {call.speakers.length > 6 && (
              <span className="flex h-5 items-center pl-2.5 text-[11px] text-text-faint">
                +{call.speakers.length - 6}
              </span>
            )}
          </div>
          <span className="text-[12px] text-text-faint">
            {clockTime(date)} · {PLATFORM_LABEL[call.platform] ?? call.platform}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * The card art is the call's own waveform, not a stock gradient — two meetings look different
 * because they *are* different, and a long quiet stretch is visible before you open it.
 */
function Thumb({ peaks, duration }: { peaks: number[]; duration: number }) {
  const bars = peaks.filter((_, i) => i % 6 === 0);
  return (
    <div className="relative hidden h-[70px] w-[120px] shrink-0 overflow-hidden rounded-md bg-surface-2 sm:block">
      <div className="flex h-full items-center gap-px px-2">
        {bars.map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px] bg-accent/45"
            style={{ height: `${Math.max(6, p * 78)}%` }}
          />
        ))}
      </div>
      <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-px font-mono text-[10px] text-white">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
