import { Laugh, Smile, Meh, Annoyed, Frown, Angry, type LucideIcon } from "lucide-react";
import type { PainLevel } from "@/lib/types";

// Meh/Annoyed/Frown are near-identical glyphs at small sizes in lucide, so
// each level also gets its own color — shared here so the log form and the
// history list always render a given level the same way.
export const PAIN_LEVELS: {
  level: Exclude<PainLevel, 0>;
  Icon: LucideIcon;
  label: string;
  textClass: string;
  bgClass: string;
}[] = [
  { level: 1, Icon: Smile, label: "Leve", textClass: "text-yellow-400", bgClass: "bg-yellow-400/10" },
  { level: 2, Icon: Meh, label: "Molesto", textClass: "text-yellow-600", bgClass: "bg-yellow-500/20" },
  { level: 3, Icon: Annoyed, label: "Incómodo", textClass: "text-amber-600", bgClass: "bg-amber-500/15" },
  { level: 4, Icon: Frown, label: "Fuerte", textClass: "text-orange-600", bgClass: "bg-orange-500/15" },
  { level: 5, Icon: Angry, label: "Muy fuerte", textClass: "text-red-600", bgClass: "bg-red-500/15" },
];

export const NO_PAIN = {
  Icon: Laugh,
  label: "Sin dolor",
  textClass: "text-brand-green",
  bgClass: "bg-brand-green/10",
};

export function painLevelInfo(level: PainLevel) {
  return level === 0 ? NO_PAIN : PAIN_LEVELS.find((l) => l.level === level)!;
}
