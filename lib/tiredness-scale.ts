import { BatteryLow, type LucideIcon } from "lucide-react";
import type { ScaleLevel } from "@/lib/types";

// Unlike pain/mood, tiredness is deliberately flat (no color-by-severity)
// on the Dashboard chart — `ScaleInput` already keeps tiredness colorless
// in the Log form on purpose (see CLAUDE.md), so the chart line follows the
// same convention instead of inventing a new severity palette just for it.
// Every level shares one textClass, only the tooltip label changes.
const LABELS: Record<ScaleLevel, string> = {
  1: "Muy descansada",
  2: "Descansada",
  3: "Normal",
  4: "Cansada",
  5: "Muy cansada",
};

const TIREDNESS_ICON: LucideIcon = BatteryLow;
const TIREDNESS_TEXT_CLASS = "text-sky-600";

export function tirednessLevelInfo(level: ScaleLevel) {
  return { Icon: TIREDNESS_ICON, label: LABELS[level], textClass: TIREDNESS_TEXT_CLASS };
}
