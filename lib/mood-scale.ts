import { Angry, Frown, Meh, Smile, Laugh, type LucideIcon } from "lucide-react";
import type { ScaleLevel } from "@/lib/types";

// Same rationale as pain-scale.ts: Angry/Frown/Meh/Smile are near-identical
// glyphs at small sizes, so each level also gets its own color. Unlike pain
// (1 = mild, 5 = severe), mood runs the other way: 1 = worst, 5 = best.
export const MOOD_LEVELS: {
  level: ScaleLevel;
  Icon: LucideIcon;
  label: string;
  textClass: string;
  bgClass: string;
}[] = [
  { level: 1, Icon: Angry, label: "Muy mal", textClass: "text-red-600", bgClass: "bg-red-500/15" },
  { level: 2, Icon: Frown, label: "Mal", textClass: "text-orange-600", bgClass: "bg-orange-500/15" },
  { level: 3, Icon: Meh, label: "Normal", textClass: "text-amber-600", bgClass: "bg-amber-500/15" },
  { level: 4, Icon: Smile, label: "Bien", textClass: "text-yellow-600", bgClass: "bg-yellow-500/20" },
  { level: 5, Icon: Laugh, label: "Muy bien", textClass: "text-green-600", bgClass: "bg-green-500/15" },
];
