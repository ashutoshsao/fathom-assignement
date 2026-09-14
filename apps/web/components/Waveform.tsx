"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useCurrentTime, useDuration, usePlayback } from "./playback";

/**
 * The scrubber.
 *
 * Drawn from precomputed peaks rather than decoding audio in the browser — an hour of audio
 * decoded client-side would stall the page before it ever painted.
 *
 * Hovering shows the time under the cursor, because on a 110-minute call "somewhere near the
 * middle" is a twenty-minute margin of error, and scrubbing blind is how you lose the thing you
 * were looking for.
 */
export function Waveform({
  peaks,
  className = "",
  maxBars = 420,
}: {
  peaks: number[];
  className?: string;
  /**
   * Bars are drawn with a 1px gap, so N bars need N px of gap alone. The seed waveform is 420
   * peaks; in the 368px-wide call rail that left every bar squeezed to sub-pixel width and the
   * scrubber rendered as empty space. Downsample to what the width can actually show.
   */
  maxBars?: number;
}) {
  const store = usePlayback();
  const time = useCurrentTime();
  const duration = useDuration();
  const ref = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const progress = duration > 0 ? time / duration : 0;

  const bars = useMemo(() => {
    if (peaks.length <= maxBars) return peaks;
    const step = peaks.length / maxBars;
    // Take the loudest peak in each bucket, so a downsampled waveform keeps its shape instead of
    // flattening towards the mean.
    return Array.from({ length: maxBars }, (_, i) =>
      Math.max(...peaks.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1))),
    );
  }, [peaks, maxBars]);

  const timeAt = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    store.seek(timeAt(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setHoverX(e.clientX - rect.left);
    if (dragging) store.seek(timeAt(e.clientX));
  };

  const hoverTime = hoverX !== null && ref.current
    ? (hoverX / ref.current.getBoundingClientRect().width) * duration
    : null;

  return (
    <div
      ref={ref}
      className={`group relative h-14 cursor-pointer select-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onPointerLeave={() => {
        setHoverX(null);
        setDragging(false);
      }}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") store.skip(-10);
        if (e.key === "ArrowRight") store.skip(10);
      }}
    >
      <div className="flex h-full items-center gap-px">
        {bars.map((p, i) => {
          const played = i / bars.length <= progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px] transition-colors"
              style={{
                // A floor of 8% disappears at small heights; unplayed bars also need to sit
                // clearly above the rail's own background or the scrubber reads as empty space.
                height: `${Math.max(16, p * 100)}%`,
                background: played ? "var(--accent)" : "#2f2f38",
              }}
            />
          );
        })}
      </div>

      {hoverX !== null && hoverTime !== null && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-white/40"
            style={{ left: hoverX }}
          />
          <div
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-text"
            style={{ left: hoverX }}
          >
            {formatShort(hoverTime)}
          </div>
        </>
      )}
    </div>
  );
}

function formatShort(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
