"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/time";
import { usePlaybackOptional } from "./playback";

export interface Citation {
  callId: string;
  callTitle: string;
  atSec: number;
  label: string;
}

interface Turn {
  question: string;
  answer: string;
  citations: Citation[];
  error?: string;
  streaming: boolean;
}

/**
 * Ask, with citations you can check.
 *
 * The citation chip is the whole point. An AI answer about a meeting is unverifiable prose until
 * you can press the claim and hear the moment it came from — so every chip seeks the player and
 * starts playing. That is also why the server resolves citations against the real transcript and
 * drops any the model invented: a chip that seeks to a fabricated moment would be worse than no
 * chip at all.
 */
export function AskPanel({
  callId,
  suggestions,
  scopeLabel,
  canSeek = true,
}: {
  callId?: string;
  suggestions: string[];
  scopeLabel: string;
  canSeek?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setValue("");
    setBusy(true);
    setTurns((t) => [...t, { question: q, answer: "", citations: [], streaming: true }]);

    const update = (fn: (t: Turn) => Turn) =>
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, callId }),
      });
      if (!res.ok || !res.body) throw new Error(`request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "delta") {
            update((t) => ({ ...t, answer: t.answer + evt.text }));
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          } else if (evt.type === "done") {
            update((t) => ({ ...t, citations: evt.citations ?? [], streaming: false }));
          } else if (evt.type === "error") {
            update((t) => ({ ...t, error: evt.message, streaming: false }));
          }
        }
      }
    } catch (err) {
      update((t) => ({
        ...t,
        error: err instanceof Error ? err.message : "Something went wrong",
        streaming: false,
      }));
    } finally {
      update((t) => ({ ...t, streaming: false }));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-5 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
          Ask Fathom
        </span>
        <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] text-text-faint">
          {scopeLabel}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {turns.length === 0 && (
          <div className="flex h-full flex-col justify-end gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="self-end rounded-full border border-line bg-surface-2 px-3 py-1.5 text-right text-[12px] text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="mb-6">
            <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-surface-3 px-3 py-2 text-[13px] leading-relaxed text-text">
              {turn.question}
            </p>

            {turn.error ? (
              <p className="text-[13px] leading-relaxed text-[#f2836b]">{turn.error}</p>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">
                  {turn.answer}
                  {turn.streaming && <Caret />}
                </p>
                {turn.citations.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {turn.citations.map((c, j) => (
                      <CitationChip key={j} citation={c} canSeek={canSeek && c.callId === callId} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="shrink-0 border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-card border border-line bg-surface-2 px-3 py-2 focus-within:border-line-strong">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(value);
              }
            }}
            rows={1}
            placeholder="Ask anything..."
            className="max-h-28 flex-1 resize-none bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[12px] text-black transition-opacity disabled:opacity-30"
          >
            {busy ? "…" : "↑"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Caret() {
  return <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />;
}

function CitationChip({ citation, canSeek }: { citation: Citation; canSeek: boolean }) {
  // On the library page there is no player at all, so this must tolerate its absence.
  const store = usePlaybackOptional();
  const router = useRouter();

  const go = () => {
    if (canSeek && store) {
      store.seek(citation.atSec);
      store.play();
    } else {
      // Cross-call citation: the audio lives on another page, so take the player there.
      router.push(`/calls/${citation.callId}?t=${Math.floor(citation.atSec)}`);
    }
  };

  return (
    <button
      onClick={go}
      className="flex w-full items-start gap-2 rounded-md border border-accent/25 bg-accent-quiet/50 px-2.5 py-2 text-left transition-colors hover:border-accent/60 hover:bg-accent-quiet"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" className="mt-0.5 shrink-0 fill-accent" aria-hidden>
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM6.5 4.8l5 3.2-5 3.2V4.8Z" />
      </svg>
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-accent">
        <span className="line-clamp-2">{citation.label}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-text-faint">
          {!canSeek && <span>{citation.callTitle} · </span>}@ {formatTime(citation.atSec)}
        </span>
      </span>
    </button>
  );
}
