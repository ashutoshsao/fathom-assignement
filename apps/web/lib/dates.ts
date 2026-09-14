/**
 * Seeded calls store `daysAgo` + `timeOfDay` rather than a fixed date.
 *
 * A meeting notetaker seeded with fixed dates starts rotting the moment it is deployed: a week
 * later the "recent" calls are last week's and the library reads as abandoned. Resolving dates
 * relative to now means whoever opens the link sees a live-looking account — there is always
 * something from today.
 */

export function resolveDate(daysAgo: number, timeOfDay: string, now = new Date()): Date {
  const [h, m] = timeOfDay.split(":").map(Number);
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** The heading a call sits under in the library: "Today", "Yesterday", then a real date. */
export function dayLabel(date: Date, now = new Date()): string {
  const startOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** "3:30 PM" — the time a meeting started, as it would appear in a calendar. */
export function clockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
