"use client";

import { formatTime } from "@/lib/time";
import { useCurrentTime, useDuration, useIsPlaying, usePlayback, useRate } from "./playback";
import { Waveform } from "./Waveform";

const RATES = [1, 1.25, 1.5, 2];

export function Player({ peaks }: { peaks: number[] }) {
  const store = usePlayback();
  const time = useCurrentTime();
  const duration = useDuration();
  const playing = useIsPlaying();
  const rate = useRate();

  return (
    <div className="border-b border-line px-4 py-3">
      <Waveform peaks={peaks} className="!h-11" maxBars={110} />

      <div className="mt-2.5 flex items-center gap-2">
        <SkipButton seconds={-10} onClick={() => store.skip(-10)} />

        <button
          onClick={store.toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-colors hover:bg-accent-hover"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause (space)" : "Play (space)"}
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="1.5" y="1" width="3" height="10" rx="1" />
              <rect x="7.5" y="1" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              {/* nudged right: a centred triangle reads as left-of-centre inside a circle */}
              <path d="M3.2 1.5v9a.7.7 0 0 0 1.07.6l7-4.5a.7.7 0 0 0 0-1.2l-7-4.5A.7.7 0 0 0 3.2 1.5Z" />
            </svg>
          )}
        </button>

        <SkipButton seconds={10} onClick={() => store.skip(10)} />

        <div className="ml-1 shrink-0 font-mono text-[11.5px] tabular-nums text-text-faint">
          <span className="text-text">{formatTime(time)}</span>
          <span className="mx-1">/</span>
          {formatTime(duration)}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => store.setRate(r)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                rate === r
                  ? "bg-surface-3 text-text"
                  : "text-text-faint hover:bg-surface-2 hover:text-text-muted"
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skip back / forward ten seconds.
 *
 * The arc-with-a-number is the convention every player uses, and it says how far it jumps without
 * a tooltip — the previous icon was an undo arrow, which read as "revert" rather than "rewind".
 */
function SkipButton({ seconds, onClick }: { seconds: number; onClick: () => void }) {
  const back = seconds < 0;
  const label = `${back ? "Back" : "Forward"} ${Math.abs(seconds)} seconds`;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={`${label} (${back ? "←" : "→"})`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden>
        <g transform={back ? undefined : "scale(-1,1) translate(-20,0)"}>
          <path
            d="M10 4.6A6.4 6.4 0 1 0 16.4 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M10 1.9v5.4L6.4 4.6 10 1.9Z" fill="currentColor" />
        </g>
        <text
          x="10"
          y="13.6"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="600"
          fill="currentColor"
          fontFamily="ui-monospace, monospace"
        >
          10
        </text>
      </svg>
    </button>
  );
}
