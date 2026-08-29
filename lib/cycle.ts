import { addDays, daysBetween } from "@/lib/date";
import type { DailyEntry } from "@/lib/types";

// Fixed-length cycle model, not derived from logged data — there isn't
// enough cycle history yet to infer a personal average, so this projects a
// textbook 26-day cycle forward from the last known period start.
const CYCLE_LENGTH = 26;
const FERTILE_WINDOW_START_DAY = 7; // cycle day, 1-indexed (day 1 = first period day)
const FERTILE_WINDOW_END_DAY = 13;
const OVULATION_DAY = 12;

// Ascending list of period-start dates — a period day whose previous day
// wasn't also a period day, so a multi-day period only counts once.
export function periodStartDates(entries: DailyEntry[]): string[] {
  const periodDates = new Set(entries.filter((e) => e.period).map((e) => e.date));
  return [...periodDates].filter((date) => !periodDates.has(addDays(date, -1))).sort();
}

// Cycle day (1-indexed) for `date`, anchored to the most recent period start
// on or before it and wrapping every CYCLE_LENGTH days — so the fertile
// window keeps projecting forward into a cycle whose next period hasn't
// been logged yet. Null if there's no known period start to anchor to
// (e.g. before the first ever logged period).
export function cycleDayOf(date: string, sortedPeriodStarts: string[]): number | null {
  let anchor: string | null = null;
  for (const start of sortedPeriodStarts) {
    if (start > date) break;
    anchor = start;
  }
  if (anchor === null) return null;
  return (daysBetween(anchor, date) % CYCLE_LENGTH) + 1;
}

export function isFertileWindow(cycleDay: number | null): boolean {
  return cycleDay !== null && cycleDay >= FERTILE_WINDOW_START_DAY && cycleDay <= FERTILE_WINDOW_END_DAY;
}

export function isOvulationDay(cycleDay: number | null): boolean {
  return cycleDay === OVULATION_DAY;
}
