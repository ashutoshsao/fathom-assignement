"use client";

import { formatTime } from "@/lib/time";
import type { Call } from "@/lib/types";
import { usePlayback } from "./playback";

/**
 * The summary, with every claim traceable.
 *
 * Each takeaway and topic carries the timestamp it was drawn from, and clicking it plays that
 * moment. That is the difference between notes you trust and notes you have to re-listen to the
 * whole call to verify — and it is why the pipeline makes the model cite a segment id rather than
 * writing loose prose.
 */
export function SummaryPane({ call }: { call: Call }) {
  const { summary } = call;
  return (
    <div className="max-w-[640px] px-7 py-6">
      <Section title="Meeting purpose">
        {/* The one paragraph that should be read first, so it leads the body text. */}
        <p className="text-lead leading-[1.6] text-text">{summary.purpose}</p>
      </Section>

      <Section title="Key takeaways">
        <ul className="space-y-2.5">
          {summary.keyTakeaways.map((k, i) => (
            <li key={i} className="flex gap-3 text-body leading-[var(--lh-body)] text-[#c9c9d1]">
              <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-accent" />
              <span>
                {k.point} <Stamp at={k.atSec} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {summary.topics.map((topic, i) => (
        <Section key={i} title={topic.heading} at={topic.atSec}>
          <ul className="space-y-2">
            {topic.points.map((p, j) => (
              <li key={j} className="flex gap-3 text-body leading-[var(--lh-body)] text-text-muted">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {summary.nextSteps.length > 0 && (
        <Section title="Next steps">
          <ul className="space-y-2">
            {summary.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3 text-body leading-[var(--lh-body)] text-text-muted">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, at, children }: { title: string; at?: number; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="label mb-2.5 flex items-center gap-2.5">
        {title}
        {at !== undefined && <Stamp at={at} />}
      </h3>
      {children}
    </section>
  );
}

export function Stamp({ at }: { at: number }) {
  const store = usePlayback();
  return (
    <button
      onClick={() => {
        store.seek(at);
        store.play();
      }}
      className="inline-block rounded-[5px] border border-line bg-surface-2 px-1.5 py-px align-[1px] font-mono text-[11px] text-text-muted transition-colors hover:border-accent/50 hover:bg-accent-quiet hover:text-accent"
      title={`Play from ${formatTime(at)}`}
    >
      {formatTime(at)}
    </button>
  );
}
