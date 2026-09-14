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

      <div className="mt-2.5 flex items-center gap-2.5">
        <button
          onClick={() => store.skip(-10)}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="Back 10 seconds"
          title="Back 10s (←)"
        >
          <Icon d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" flip />
        </button>

        <button
          onClick={store.toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-black transition-colors hover:bg-accent-hover"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause (space)" : "Play (space)"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <path d="M3 1.8v10.4a.8.8 0 0 0 1.22.68l8.4-5.2a.8.8 0 0 0 0-1.36l-8.4-5.2A.8.8 0 0 0 3 1.8Z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => store.skip(10)}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="Forward 10 seconds"
          title="Forward 10s (→)"
        >
          <Icon d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" />
        </button>

        <div className="font-mono text-[11.5px] tabular-nums text-text-faint">
          <span className="text-text">{formatTime(time)}</span>
          <span className="mx-1">/</span>
          {formatTime(duration)}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => store.setRate(r)}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
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

function Icon({ d, flip = false }: { d: string; flip?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      style={flip ? undefined : { transform: "scaleX(-1)" }}
    >
      <path d={d} />
    </svg>
  );
}
