import { BatteryLow, Smile, type LucideIcon } from "lucide-react";

// Continuous 1-5 series — distinct from the boolean EventKey series in
// event-icons.ts — that can optionally be overlaid on the Dolor chart as a
// flat grey line (see DashboardView's `visibleOverlays` and MetricChart's
// `overlays` prop). Each also gets its own always-visible standalone chart
// below Dolor; this toggle only controls whether it *additionally* appears
// layered on top of pain.
export type OverlayMetricKey = "tiredness" | "mood";

export const OVERLAY_METRIC_META: Record<
  OverlayMetricKey,
  { Icon: LucideIcon; label: string; textClass: string; dashed: boolean }
> = {
  // `dashed` gives the two overlay lines a distinct shape (not just color,
  // since both render in the same flat grey) so they stay tellable apart
  // when both are toggled on at once.
  tiredness: { Icon: BatteryLow, label: "Cansancio", textClass: "text-amber-500", dashed: true },
  mood: { Icon: Smile, label: "Ánimo", textClass: "text-fuchsia-400", dashed: false },
};

export const OVERLAY_METRIC_ORDER: OverlayMetricKey[] = ["tiredness", "mood"];
