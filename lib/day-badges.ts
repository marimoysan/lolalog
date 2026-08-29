import { Droplet, Zap, Heart, type LucideIcon } from "lucide-react";
import type { DailyEntry } from "@/lib/types";

// Small at-a-glance icons for the history list (and, later, the Dashboard)
// — kept separate from pain-scale.ts since these are independent yes/no
// signals, not a single graded scale. Deliberately monochrome: color in
// this row is reserved for the pain indicator (the primary signal), and
// these three shapes (droplet/zap/heart) are distinct enough not to need
// it — see pain-scale.ts, where color is used to disambiguate near-
// identical glyphs, which isn't the case here.
export type DayBadge = { key: string; Icon: LucideIcon; label: string };

export const BADGE_CLASS = "text-neutral-500";

// Either a logged sport, or the activity scale maxed out (walking a lot
// without a specific sport still counts) — shared with the Dashboard's
// event overlay so both read this signal the same way.
export function hasIntenseActivity(entry: DailyEntry): boolean {
  return entry.activityLevel === 5 || entry.sports.length > 0;
}

export function dayBadges(entry: DailyEntry): DayBadge[] {
  const badges: DayBadge[] = [];

  if (entry.period) {
    badges.push({ key: "period", Icon: Droplet, label: "Regla" });
  }

  if (hasIntenseActivity(entry)) {
    badges.push({ key: "activity", Icon: Zap, label: "Actividad intensa" });
  }

  if (entry.sex) {
    badges.push({ key: "sex", Icon: Heart, label: "Relaciones sexuales" });
  }

  return badges;
}
