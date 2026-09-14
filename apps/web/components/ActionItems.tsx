"use client";

import type { Call } from "@/lib/types";
import { SpeakerChip } from "./SpeakerChip";
import { Stamp } from "./SummaryPane";

export function ActionItems({ call }: { call: Call }) {
  const speakers = new Map(call.speakers.map((s) => [s.id, s]));

  if (call.actionItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-[14px] text-text-muted">No action items detected</p>
        <p className="mt-1.5 text-[13px] text-text-faint">
          Nobody committed to anything specific in this call.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <ul className="space-y-2">
        {call.actionItems.map((item) => {
          const who = item.assignee === null ? null : speakers.get(item.assignee);
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-card border border-line bg-surface p-3.5"
            >
              <SpeakerChip speaker={who} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-relaxed text-text">{item.text}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[12px] text-text-faint">
                  <span>{who?.name ?? "Unassigned"}</span>
                  <Stamp at={item.atSec} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
