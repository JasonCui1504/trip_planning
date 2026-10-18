// Date helpers that work on naive local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" strings.

export function parseDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000);
}

/** Combine a date and minutes-after-midnight into a local ISO datetime. */
export function atMinutes(date: string, minutes: number): string {
  const d = parseDate(date);
  d.setUTCMinutes(minutes);
  return d.toISOString().slice(0, 16);
}

export function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime());
}
