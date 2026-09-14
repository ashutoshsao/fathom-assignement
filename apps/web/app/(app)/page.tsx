import { CallCard } from "@/components/CallCard";
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
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-6">
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold text-text-muted">{label}</h2>
          <div className="space-y-2">
            {items.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
