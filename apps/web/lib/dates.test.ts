import { describe, expect, test } from "bun:test";
import { clockTime, dayLabel, resolveDate } from "./dates";

// A fixed "now" so these tests do not change meaning depending on when they run.
const now = new Date("2026-09-14T18:00:00");

describe("resolveDate", () => {
  test("daysAgo 0 is today, at the stated time", () => {
    const d = resolveDate(0, "15:30", now);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(30);
  });

  test("counts back across a month boundary", () => {
    const d = resolveDate(27, "14:00", now);
    expect(d.getMonth()).toBe(7); // August
    expect(d.getDate()).toBe(18);
  });

  test("a malformed time does not produce an Invalid Date", () => {
    expect(Number.isNaN(resolveDate(1, "", now).getTime())).toBe(false);
  });
});

describe("dayLabel", () => {
  test("names the recent days the way a person would", () => {
    expect(dayLabel(resolveDate(0, "15:30", now), now)).toBe("Today");
    expect(dayLabel(resolveDate(1, "10:00", now), now)).toBe("Yesterday");
  });

  test("within the week, the weekday is more useful than a date", () => {
    // 2026-09-14 minus 3 days is Friday 2026-09-11
    expect(dayLabel(resolveDate(3, "10:00", now), now)).toBe("Friday");
  });

  test("older than a week falls back to a date", () => {
    expect(dayLabel(resolveDate(13, "09:30", now), now)).toMatch(/September/);
  });

  test("a call earlier today is still Today, not a negative day count", () => {
    const earlier = new Date("2026-09-14T09:00:00");
    expect(dayLabel(earlier, now)).toBe("Today");
  });

  test("late-night now vs early-morning call still reads as the same day", () => {
    const lateNow = new Date("2026-09-14T23:59:00");
    const earlyCall = new Date("2026-09-14T00:30:00");
    expect(dayLabel(earlyCall, lateNow)).toBe("Today");
  });
});

describe("clockTime", () => {
  test("renders a wall-clock time", () => {
    expect(clockTime(new Date("2026-09-14T15:30:00"))).toMatch(/3:30/);
  });
});
