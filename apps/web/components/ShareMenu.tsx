"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/time";
import { useCurrentTime, usePlayback } from "./playback";

const CLIP_SECONDS = 60;

/**
 * Share a call, a moment, or a clip.
 *
 * The three options exist because they answer different questions. "Here is the meeting" is
 * rarely what you mean — usually it is "listen to this bit", and making somebody scrub through
 * an hour to find it is how a share link gets ignored.
 */
export function ShareMenu({ callId, durationSec }: { callId: string; durationSec: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const time = useCurrentTime();
  const store = usePlayback();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const at = Math.floor(time);
  const clipStart = Math.max(0, at - CLIP_SECONDS / 2);
  const clipEnd = Math.min(durationSec, clipStart + CLIP_SECONDS);

  const options = [
    { key: "call", label: "Whole call", detail: "From the beginning", path: `/share/${callId}` },
    {
      key: "moment",
      label: "From this moment",
      detail: `Opens at ${formatTime(at)}`,
      path: `/share/${callId}?t=${at}`,
    },
    {
      key: "clip",
      label: "Just this clip",
      detail: `${formatTime(clipStart)}–${formatTime(clipEnd)}, stops at the end`,
      path: `/share/${callId}?clip=${Math.floor(clipStart)}-${Math.floor(clipEnd)}`,
    },
  ];

  async function copy(key: string, path: string) {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked; showing the URL is better than failing silently.
      window.prompt("Copy this link", url);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          store.audio()?.pause();
          setOpen((o) => !o);
        }}
        className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-accent-hover"
      >
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[290px] rounded-card border border-line bg-surface-2 p-1.5 shadow-2xl">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => copy(o.key, o.path)}
              className="block w-full rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-3"
            >
              <span className="block text-[13px] text-text">
                {copied === o.key ? "Link copied" : o.label}
              </span>
              <span className="block text-[11px] text-text-faint">{o.detail}</span>
            </button>
          ))}
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] leading-relaxed text-text-faint">
            Anyone with the link can open it — no account needed.
          </p>
        </div>
      )}
    </div>
  );
}
