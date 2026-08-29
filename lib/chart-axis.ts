import { addDays, formatDayMonth, formatDisplayDate } from "@/lib/date";
import type { Granularity } from "@/lib/aggregate";

// Spanish calendar-strip convention (miércoles = X, to not collide with martes).
const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];

export type AxisPoint = { date: string };
export type AxisLabel = { index: number; primary: string; secondary?: string };

export function toLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

// Few enough points that every day fits without collisions: label each one
// with its weekday letter + day number instead of spreading out sparse ticks.
const DENSE_LABEL_THRESHOLD = 10;
const SPARSE_LABEL_COUNT = 8;

function pickSparseIndices(count: number): number[] {
  const steps = SPARSE_LABEL_COUNT - 1;
  const indices = new Set<number>();
  for (let s = 0; s <= steps; s++) {
    indices.add(Math.round((s / steps) * (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

// count <= 10: every day, "weekday letter" over "day number".
// count > 10: ~8 evenly spread days, spelling out the full month name
// whenever the month changes so the range never reads as bare numbers.
function buildDayAxisLabels(points: AxisPoint[]): AxisLabel[] {
  const count = points.length;
  if (count === 0) return [];

  if (count <= DENSE_LABEL_THRESHOLD) {
    return points.map((p, i) => ({
      index: i,
      primary: String(toLocalDate(p.date).getDate()),
      secondary: WEEKDAY_LETTERS[toLocalDate(p.date).getDay()],
    }));
  }

  return pickSparseIndices(count).reduce<{ labels: AxisLabel[]; lastMonth: number | null }>(
    (acc, i) => {
      const date = toLocalDate(points[i].date);
      const month = date.getMonth();
      const isNewMonth = acc.lastMonth === null || month !== acc.lastMonth;
      acc.labels.push({
        index: i,
        primary: String(date.getDate()),
        secondary: isNewMonth ? date.toLocaleDateString("es-ES", { month: "long" }) : undefined,
      });
      acc.lastMonth = month;
      return acc;
    },
    { labels: [], lastMonth: null },
  ).labels;
}

// One point per week (Monday of that week): always labeled with its day
// number, spelling out the month whenever it changes — same shape as the
// sparse daily labels, just without a weekday letter (misleading here since
// every point is a Monday).
function buildWeekAxisLabels(points: AxisPoint[]): AxisLabel[] {
  const count = points.length;
  if (count === 0) return [];
  const indices = count <= DENSE_LABEL_THRESHOLD ? points.map((_, i) => i) : pickSparseIndices(count);

  let lastMonth: number | null = null;
  return indices.map((i) => {
    const date = toLocalDate(points[i].date);
    const month = date.getMonth();
    const isNewMonth = lastMonth === null || month !== lastMonth;
    lastMonth = month;
    return {
      index: i,
      primary: String(date.getDate()),
      secondary: isNewMonth ? date.toLocaleDateString("es-ES", { month: "long" }) : undefined,
    };
  });
}

// One point per month (1st of that month): labeled with the short month
// name, spelling out the year whenever it changes.
function buildMonthAxisLabels(points: AxisPoint[]): AxisLabel[] {
  const count = points.length;
  if (count === 0) return [];
  const indices = count <= DENSE_LABEL_THRESHOLD ? points.map((_, i) => i) : pickSparseIndices(count);

  let lastYear: number | null = null;
  return indices.map((i) => {
    const date = toLocalDate(points[i].date);
    const year = date.getFullYear();
    const isNewYear = lastYear === null || year !== lastYear;
    lastYear = year;
    const monthName = date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    return {
      index: i,
      primary: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      secondary: isNewYear ? String(year) : undefined,
    };
  });
}

export function buildAxisLabels(points: AxisPoint[], granularity: Granularity): AxisLabel[] {
  if (granularity === "week") return buildWeekAxisLabels(points);
  if (granularity === "month") return buildMonthAxisLabels(points);
  return buildDayAxisLabels(points);
}

// Tooltip headline for the active point: a full weekday+date for daily
// points, a "Semana del X al Y" range for weekly ones (weeks are always
// Monday+6 days, matching groupByWeek), and "Mes Año" for monthly ones.
export function tooltipDateLabel(date: string, granularity: Granularity): string {
  if (granularity === "day") return formatDisplayDate(date);
  if (granularity === "week") {
    return `Semana del ${formatDayMonth(date)} al ${formatDayMonth(addDays(date, 6))}`;
  }
  const monthYear = toLocalDate(date).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
}
