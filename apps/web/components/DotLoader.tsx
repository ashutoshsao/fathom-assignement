"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A dot-matrix loader: a bright head travels an inward spiral, trailing a fade.
 *
 * Stepped from JS rather than a CSS keyframe, deliberately. Our reduced-motion rule caps
 * `animation-iteration-count`, which correctly stops decorative loops — but it would also freeze
 * this, and a silent thirty-second wait reading as a hang is its own accessibility problem.
 * Driving frames in JS lets the preference *reduce* the motion rather than delete it: the spiral
 * is replaced by a slow collective breathe, so nothing travels across the screen and nothing
 * flashes, but the indicator is still visibly alive.
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
    // ~14fps normally; ~3fps when motion is reduced. Neither is fast enough to read as a flash.
    const id = setInterval(() => setFrame((f) => f + 1), calm ? 320 : 70);
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
        let opacity: number;
        if (calm) {
          // Reduced: the whole matrix breathes together — no travelling head to follow.
          opacity = 0.24 + 0.34 * (0.5 + 0.5 * Math.sin(frame / 3));
        } else {
          // Distance behind the head along the spiral, so the trail fades out smoothly.
          const behind = (head - rank[i]! + total) % total;
          opacity = behind < 7 ? 1 - behind * 0.13 : 0.14;
        }
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
