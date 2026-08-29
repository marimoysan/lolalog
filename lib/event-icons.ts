import { Egg, Heart, Wine, Zap, type LucideIcon } from "lucide-react";

// Booleans from DailyEntry that the Dashboard can plot as day-lanes (daily
// view) or translucent overlay bars (weekly/monthly view) on top of pain.
// "activity" reuses the same "actividad intensa" signal as the History list
// (see lib/day-badges.ts): a logged sport OR the activity scale maxed out.
export type EventKey = "sex" | "activity" | "alcohol";

export const EVENT_META: Record<EventKey, { Icon: LucideIcon; label: string; textClass: string }> = {
  sex: { Icon: Heart, label: "Sexo", textClass: "text-pink-500" },
  activity: { Icon: Zap, label: "Actividad", textClass: "text-sky-500" },
  alcohol: { Icon: Wine, label: "Alcohol", textClass: "text-purple-500" },
};

export const EVENT_ORDER: EventKey[] = ["sex", "activity", "alcohol"];

// Period is a run of several consecutive days, always shown as background
// shading — not togglable, not a lane — see PainChart's periodFlags prop.
export const PERIOD_SHADE_CLASS = "fill-rose-500/15";

// Fertile window: same idea as period shading (a run of days, always on,
// not togglable), in a distinct light-blue tint. Ovulation is the single
// day within it, marked with an icon instead of shading — see PainChart's
// fertileFlags/ovulationFlags props.
export const FERTILE_SHADE_CLASS = "fill-sky-300/15";
export const OVULATION_META = { Icon: Egg, label: "Ovulación", textClass: "text-sky-300" };
