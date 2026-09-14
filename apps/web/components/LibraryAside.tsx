"use client";

import { useState } from "react";
import { SUGGESTED_ALL } from "@/lib/ask-suggestions";
import { AskPanel } from "./AskPanel";

/**
 * Ask across the whole library.
 *
 * Collapsed by default: the library's job is to get you into a call, and a permanently open chat
 * panel would compete with that. Open it and it stays, because once you are asking questions
 * across meetings you tend to ask several.
 */
export function LibraryAside() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 rounded-full border border-line-strong bg-surface-2 px-4 py-2.5 text-[13px] text-text shadow-xl transition-colors hover:border-accent hover:text-accent"
      >
        Ask across all calls
      </button>
    );
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line">
      <div className="flex shrink-0 items-center justify-between px-5 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
          Across your calls
        </span>
        <button
          onClick={() => setOpen(false)}
          className="rounded px-1.5 text-[13px] text-text-faint hover:text-text"
          aria-label="Close Ask"
        >
          ✕
        </button>
      </div>
      <AskPanel suggestions={SUGGESTED_ALL} scopeLabel="All calls" canSeek={false} />
    </aside>
  );
}
