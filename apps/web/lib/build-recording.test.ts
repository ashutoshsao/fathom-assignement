import { describe, expect, test } from "bun:test";
import { buildRecordedCall } from "./build-recording";

const transcript = {
  speakers: [
    { id: 0, name: "Ashutosh" },
    { id: 1, name: "Speaker 2" },
  ],
  segments: [
    { startSec: 0, endSec: 4, speaker: 0, text: "Right, shall we start?" },
    { startSec: 4, endSec: 9.5, speaker: 1, text: "Yes. I'll send the doc by Friday." },
    { startSec: 9.5, endSec: 14, speaker: 0, text: "Great, thanks." },
  ],
};

const notes = {
  title: "Quick sync",
  blurb: "A short catch-up.",
  purpose: "Agree next steps.",
  keyTakeaways: [{ point: "The doc is due Friday", segmentIndex: 1 }],
  topics: [{ heading: "Next steps", points: ["Doc by Friday"], segmentIndex: 1 }],
  actionItems: [{ text: "Send the doc", assignee: "Speaker 2", segmentIndex: 1 }],
  nextSteps: ["Review the doc"],
};

const build = (overrides: Partial<Parameters<typeof buildRecordedCall>[0]> = {}) =>
  buildRecordedCall({
    id: "rec-1",
    transcript,
    notes,
    durationSec: 14,
    waveform: [0.5, 0.9],
    marks: [],
    ...overrides,
  });

describe("buildRecordedCall", () => {
  test("resolves every model-chosen index to a real timestamp", () => {
    const call = build();
    expect(call.summary.keyTakeaways[0]!.atSec).toBe(4);
    expect(call.summary.topics[0]!.atSec).toBe(4);
    expect(call.actionItems[0]!.atSec).toBe(4);
  });

  test("maps an assignee name onto a real speaker id", () => {
    expect(build().actionItems[0]!.assignee).toBe(1);
  });

  test("an assignee nobody recognises becomes unassigned, not a wrong person", () => {
    const call = build({
      notes: { ...notes, actionItems: [{ text: "x", assignee: "Nobody", segmentIndex: 0 }] },
    });
    expect(call.actionItems[0]!.assignee).toBeNull();
  });

  test("an out-of-range segment index falls back to the start rather than crashing", () => {
    const call = build({
      notes: { ...notes, keyTakeaways: [{ point: "bogus", segmentIndex: 99 }] },
    });
    expect(call.summary.keyTakeaways[0]!.atSec).toBe(0);
  });

  test("a segment attributed to an unknown speaker is left unattributed", () => {
    const call = build({
      transcript: {
        ...transcript,
        segments: [{ startSec: 0, endSec: 1, speaker: 7, text: "who said this" }],
      },
    });
    expect(call.transcript[0]!.speaker).toBeNull();
  });

  test("marks made during the call become highlights at the right moment", () => {
    const call = build({ marks: [3.5, 11] });
    expect(call.highlights.map((h) => h.atSec)).toEqual([3.5, 11]);
  });

  test("speakers get initials and distinct colours", () => {
    const call = build();
    expect(call.speakers[0]!.initials).toBe("AS");
    expect(call.speakers[0]!.colorIndex).not.toBe(call.speakers[1]!.colorIndex);
  });

  test("a recording is dated today so it sorts to the top of the library", () => {
    expect(build().daysAgo).toBe(0);
  });
});
