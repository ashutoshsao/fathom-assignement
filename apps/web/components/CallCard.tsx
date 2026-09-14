import Link from "next/link";
import { clockTime, resolveDate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { CallSummaryCard } from "@/lib/types";
import { SpeakerChip } from "./SpeakerChip";

/**
 * A stable colour per call.
 *
 * Tinting by the first speaker looked right until the data arrived: every call's first speaker is
 * id 0, so all five cards came out the same blue. Deriving it from the call id is what actually
 * makes them distinguishable.
 */
function tintFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}

const PLATFORM_LABEL: Record<string, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

export function CallCard({ call }: { call: CallSummaryCard }) {
  const date = resolveDate(call.daysAgo, call.timeOfDay);
  const names = call.speakers.map((s) => s.name).filter((n) => !/^Speaker \d/.test(n));
  const who =
    names.length === 0
      ? `${call.speakers.length} speakers`
      : names.length <= 2
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

  return (
    <Link
      href={`/calls/${call.id}`}
      className="group flex gap-4 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <Thumb peaks={call.waveform} duration={call.durationSec} tint={tintFor(call.id)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.011em] text-text group-hover:text-accent">
            {call.title}
          </h3>
          <span className="shrink-0 font-mono text-[10.5px] text-text-faint">{clockTime(date)}</span>
        </div>
        <p className="line-clamp-2 text-ui leading-[1.55] text-text-muted">{call.blurb}</p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <div className="flex -space-x-1">
            {call.speakers.slice(0, 4).map((s) => (
              <SpeakerChip key={s.id} speaker={s} size={19} ring />
            ))}
          </div>
          <span className="truncate text-[11.5px] text-text-faint">{who}</span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-line-strong" aria-hidden />
          <span className="shrink-0 text-[11.5px] text-text-faint">
            {PLATFORM_LABEL[call.platform] ?? call.platform}
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
/**
 * The card art is the call's own waveform, tinted with the first speaker's colour.
 *
 * Five calls of the same recurring meeting looked identical as flat blue bars — the tint is what
 * lets you tell them apart before reading a word.
 */
function Thumb({ peaks, duration, tint }: { peaks: number[]; duration: number; tint: number }) {
  const bars = peaks.filter((_, i) => i % 5 === 0);
  const color = `var(--sp-${(tint % 8) + 1})`;
  return (
    <div className="relative hidden h-[72px] w-[112px] shrink-0 overflow-hidden rounded-[7px] bg-[#17171b] sm:block">
      <div className="flex h-full items-end gap-px px-2 pb-2.5 pt-2.5">
        {bars.map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${Math.max(8, p * 100)}%`,
              background: `color-mix(in srgb, ${color} 55%, transparent)`,
            }}
          />
        ))}
      </div>
      <span className="absolute bottom-1 right-1 rounded bg-bg/75 px-1.5 py-px font-mono text-[9.5px] text-text-muted">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
