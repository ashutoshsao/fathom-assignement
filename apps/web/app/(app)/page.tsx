import { CallCard } from "@/components/CallCard";
import { LibraryAside } from "@/components/LibraryAside";
import { LocalRecordings } from "@/components/LocalRecordings";
import { Recorder } from "@/components/Recorder";
import { dayLabel, resolveDate } from "@/lib/dates";
import { getCallIndex } from "@/lib/seed";
import type { CallSummaryCard } from "@/lib/types";

export default async function LibraryPage() {
  const calls = await getCallIndex();

  if (calls.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="text-[16px] text-text">No calls yet</h2>
        <p className="mt-2 text-[13px] text-text-faint">
          Run the seed pipeline in <code className="font-mono">scripts/</code> to populate the
          library.
        </p>
      </div>
    );
  }

  // Group by day so the library reads like a calendar rather than an undifferentiated feed.
  const groups = new Map<string, CallSummaryCard[]>();
  for (const call of [...calls].sort((a, b) => a.daysAgo - b.daysAgo)) {
    const label = dayLabel(resolveDate(call.daysAgo, call.timeOfDay));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(call);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-6 pb-24">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.022em] text-text">My Calls</h1>
          <p className="mt-1 text-meta text-text-muted">
            {calls.length} recordings · {Math.round(calls.reduce((n, c) => n + c.durationSec, 0) / 3600)}h of conversation
          </p>
        </div>
        <Recorder />
      </div>
      <LocalRecordings />
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} className="mb-7">
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="label">{label}</h2>
            <div className="h-px flex-1 bg-surface-2" />
          </div>
          <div className="space-y-2">
            {items.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        </section>
      ))}
      </div>
      <LibraryAside />
    </div>
  );
}
