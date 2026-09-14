"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/time";

interface Hit {
  callId: string;
  callTitle: string;
  atSec: number;
  speaker: string | null;
  excerpt: string;
  match: [number, number];
}

/**
 * Search across every call.
 *
 * Results link to `/calls/<id>?t=<sec>`, so a hit does not just tell you which call said it — it
 * opens that call with the player already sitting on the moment.
 */
export function Search() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Debounced: a keystroke-per-request would search 55k words on every letter.
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(data.hits ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={boxRef} className="relative ml-auto w-full max-w-[300px]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search across calls"
        aria-label="Search call recordings"
        className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-line-strong"
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 top-full z-30 mt-1.5 max-h-[70vh] w-[520px] max-w-[92vw] overflow-y-auto rounded-card border border-line bg-surface-2 py-1.5 shadow-2xl">
          {loading && hits.length === 0 && (
            <p className="px-3.5 py-3 text-[13px] text-text-faint">Searching…</p>
          )}
          {!loading && hits.length === 0 && (
            <p className="px-3.5 py-3 text-[13px] text-text-faint">
              Nothing said about “{q}” in these calls.
            </p>
          )}
          {hits.map((h, i) => (
            <Link
              key={i}
              href={`/calls/${h.callId}?t=${Math.floor(h.atSec)}`}
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 transition-colors hover:bg-surface-3"
            >
              <div className="flex items-baseline gap-2 text-[11px] text-text-faint">
                <span className="truncate">{h.callTitle}</span>
                <span className="font-mono">{formatTime(h.atSec)}</span>
                {h.speaker && <span className="truncate">· {h.speaker}</span>}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-text-muted">
                {h.excerpt.slice(0, h.match[0])}
                <mark className="bg-accent-quiet text-accent">
                  {h.excerpt.slice(h.match[0], h.match[1])}
                </mark>
                {h.excerpt.slice(h.match[1])}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
