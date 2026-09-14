import { describe, expect, test } from "bun:test";
import {
  formatDuration,
  formatTime,
  groupBySpeaker,
  initialsFor,
  segmentIndexAt,
  snapToSegmentStart,
} from "./time";
import type { TranscriptSegment } from "./types";

const seg = (id: number, startSec: number, endSec: number, speaker: number | null = 0):
  TranscriptSegment => ({ id, startSec, endSec, text: `line ${id}`, speaker });

describe("formatTime", () => {
  test("under an hour drops the hour field", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7)).toBe("0:07");
    expect(formatTime(247)).toBe("4:07");
  });

  test("past an hour shows it, zero-padded", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3847)).toBe("1:04:07");
    // our longest seeded call
    expect(formatTime(6594)).toBe("1:49:54");
  });

  test("negative and fractional times do not produce garbage", () => {
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(59.9)).toBe("0:59");
  });
});

describe("formatDuration", () => {
  test("reads as a scannable length", () => {
    expect(formatDuration(3000)).toBe("50m");
    expect(formatDuration(6594)).toBe("1h 50m");
    expect(formatDuration(3600)).toBe("1h 0m");
  });
});

describe("segmentIndexAt", () => {
  const segments = [seg(0, 0, 5), seg(1, 5, 10), seg(2, 10, 12), seg(3, 20, 25)];

  test("finds the segment containing the time", () => {
    expect(segmentIndexAt(segments, 0)).toBe(0);
    expect(segmentIndexAt(segments, 7)).toBe(1);
    expect(segmentIndexAt(segments, 11.5)).toBe(2);
  });

  test("boundaries belong to the segment starting there", () => {
    expect(segmentIndexAt(segments, 5)).toBe(1);
    expect(segmentIndexAt(segments, 10)).toBe(2);
  });

  test("holds the previous line through a gap rather than flickering to nothing", () => {
    expect(segmentIndexAt(segments, 15)).toBe(2);
  });

  test("before the first segment there is nothing to highlight", () => {
    expect(segmentIndexAt([seg(0, 4, 9)], 1)).toBe(-1);
    expect(segmentIndexAt([], 3)).toBe(-1);
  });

  test("past the end stays on the last segment", () => {
    expect(segmentIndexAt(segments, 9999)).toBe(3);
  });

  test("agrees with a linear scan across a long transcript", () => {
    const many = Array.from({ length: 2326 }, (_, i) => seg(i, i * 2.5, i * 2.5 + 2));
    for (const t of [0, 1, 2.5, 1234.9, 3000, 5814.5, 5815]) {
      let expected = -1;
      for (let i = 0; i < many.length; i++) if (many[i]!.startSec <= t) expected = i;
      expect(segmentIndexAt(many, t)).toBe(expected);
    }
  });
});

describe("snapToSegmentStart", () => {
  const segments = [seg(0, 0, 5), seg(1, 5.25, 10)];

  test("a citation mid-sentence seeks to where the line starts", () => {
    expect(snapToSegmentStart(segments, 7.8)).toBe(5.25);
  });

  test("before the first line, seek to the top", () => {
    expect(snapToSegmentStart([seg(0, 9, 12)], 2)).toBe(0);
  });
});

describe("groupBySpeaker", () => {
  test("merges consecutive segments by the same speaker", () => {
    const blocks = groupBySpeaker([
      seg(0, 0, 2, 1), seg(1, 2, 4, 1), seg(2, 4, 6, 2), seg(3, 6, 8, 1),
    ]);
    expect(blocks.map((b) => b.speaker)).toEqual([1, 2, 1]);
    expect(blocks[0]!.segments).toHaveLength(2);
    expect(blocks[0]!.endSec).toBe(4);
  });

  test("unattributed lines group together rather than splitting per line", () => {
    const blocks = groupBySpeaker([seg(0, 0, 2, null), seg(1, 2, 4, null)]);
    expect(blocks).toHaveLength(1);
  });

  test("empty transcript yields no blocks", () => {
    expect(groupBySpeaker([])).toEqual([]);
  });
});

describe("initialsFor", () => {
  test("handles the single-word handles our seed data actually contains", () => {
    expect(initialsFor("Honkeymagoo")).toBe("HO");
    expect(initialsFor("Ken")).toBe("KE");
  });

  test("uses first and last for real names", () => {
    expect(initialsFor("Dave Morris")).toBe("DM");
    expect(initialsFor("Some Guy On The Internet")).toBe("SI");
  });

  test("does not crash on empty input", () => {
    expect(initialsFor("   ")).toBe("?");
  });
});
