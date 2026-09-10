import { mondayOf, firstOfMonth } from "@/lib/date";

export type Granularity = "day" | "week" | "month";

export type Bucket = { date: string; dates: string[] };
export type CountPoint = { date: string; count: number };

function groupBy(dates: string[], keyOf: (date: string) => string): Bucket[] {
  const buckets = new Map<string, string[]>();
  for (const date of dates) {
    const key = keyOf(date);
    const group = buckets.get(key);
    if (group) group.push(date);
    else buckets.set(key, [date]);
  }
  // `dates` arrives ascending, so Map insertion order keeps buckets ascending too.
  return [...buckets.entries()].map(([date, bucketDates]) => ({ date, dates: bucketDates }));
}

// Buckets by the Monday of each date's week, regardless of which weekday the
// range starts on.
export function groupByWeek(dates: string[]): Bucket[] {
  return groupBy(dates, mondayOf);
}

export function groupByMonth(dates: string[]): Bucket[] {
  return groupBy(dates, firstOfMonth);
}

// Rounds to the nearest registered level, generic over any of the app's
// bounded numeric scales (pain, tiredness, mood — all plotted the same way
// on the Dashboard). Null only when every day in the bucket is
// unregistered — distinct from an average that rounds to 0.
export function averageLevel<T extends number>(levels: (T | null)[]): T | null {
  const present = levels.filter((l): l is T => l !== null);
  if (present.length === 0) return null;
  const avg = present.reduce((sum: number, l) => sum + l, 0) / present.length;
  return Math.round(avg) as T;
}
