"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A dot-matrix loader: a bright head travels an inward spiral, trailing a fade.
 *
 * Stepped from JS rather than a CSS keyframe, deliberately. Our reduced-motion rule caps
 * `animation-iteration-count`, which correctly stops decorative loops — but it would also freeze
 * this, and a silent thirty-second wait reading as a hang is its own accessibility problem.
 *
 * Under reduced motion the spiral keeps running, at roughly half speed. An earlier version
 * replaced it with a collective fade, which was an over-correction: the setting exists for
 * vestibular triggers — large movement, parallax, zoom, flashing — and a 15px trail is none of
 * those. The genuine offence was the strobe this file replaced (an infinite CSS animation forced
 * to a 0.01ms duration), not the travelling head. Small, slow, essential-feedback indicators are
 * the standard exception, and a dimming grid reads as a broken light rather than as progress.
 */

const N = 5;

/** Indices of an N×N grid in inward-spiral order. */
function spiralOrder(n: number): number[] {
  const order: number[] = [];
  let top = 0;
  let bottom = n - 1;
  let left = 0;
  let right = n - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) order.push(top * n + c);
    top++;
    for (let r = top; r <= bottom; r++) order.push(r * n + right);
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) order.push(bottom * n + c);
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) order.push(r * n + left);
      left++;
    }
  }
  return order;
}

export function DotLoader({ className = "" }: { className?: string }) {
  const [frame, setFrame] = useState(0);
  const [calm, setCalm] = useState(false);

  const rank = useMemo(() => {
    const order = spiralOrder(N);
    const map = new Array<number>(N * N);
    order.forEach((cell, i) => (map[cell] = i));
    return map;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCalm(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // ~14fps normally, ~7fps when motion is reduced. Both are far below anything that reads as a
    // flash (the accessibility threshold is 3 flashes per second of large or bright areas).
    const id = setInterval(() => setFrame((f) => f + 1), calm ? 140 : 70);
    return () => clearInterval(id);
  }, [calm]);

  const total = N * N;
  const head = frame % (total + 6);

  return (
    <span
      className={`inline-grid gap-[2px] ${className}`}
      style={{ gridTemplateColumns: `repeat(${N}, 3px)` }}
      aria-hidden
    >
      {Array.from({ length: total }, (_, i) => {
        // Distance behind the head along the spiral, so the trail fades out smoothly. Reduced
        // motion softens the contrast between head and trail as well as slowing it.
        const behind = (head - rank[i]! + total) % total;
        const peak = calm ? 0.8 : 1;
        const opacity = behind < 7 ? peak - behind * (calm ? 0.09 : 0.13) : 0.14;
        return (
          <span
            key={i}
            className="h-[3px] w-[3px] rounded-[1px] bg-accent"
            style={{ opacity: Math.max(0.12, opacity) }}
          />
        );
      })}
    </span>
  );
}
