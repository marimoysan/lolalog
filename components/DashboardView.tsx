"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { DashboardGranularityPicker } from "@/components/DashboardGranularityPicker";
import { MetricChart, type OverlaySeries } from "@/components/MetricChart";
import { useEntries } from "@/lib/db/entries-store";
import { datesInRange, lastNDays, todayISO } from "@/lib/date";
import { averageLevel, groupByMonth, groupByWeek, type CountPoint, type Granularity } from "@/lib/aggregate";
import { hasIntenseActivity } from "@/lib/day-badges";
import { cycleDayOf, isFertileWindow, isOvulationDay, periodStartDates } from "@/lib/cycle";
import { EVENT_META, EVENT_ORDER, type EventKey } from "@/lib/event-icons";
import { OVERLAY_METRIC_META, OVERLAY_METRIC_ORDER, type OverlayMetricKey } from "@/lib/overlay-metrics";
import { painLevelInfo } from "@/lib/pain-scale";
import { moodLevelInfo } from "@/lib/mood-scale";
import { tirednessLevelInfo } from "@/lib/tiredness-scale";
import type { PainLevel, ScaleLevel } from "@/lib/types";

type Preset = "week" | "month" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
  { value: "custom", label: "Custom" },
];

// Sane upper bound for a custom range so a typo'd year can't try to render
// thousands of points.
const MAX_CUSTOM_DAYS = 366;

// Tiredness/mood are both ScaleLevel (1-5), unlike pain's 0-5 — used both
// for their own standalone charts and for their overlay on Dolor.
const SCALE_RANGE: [number, number] = [1, 5];

// MetricChart wants `(value: number) => ...`; the individual *-scale.ts
// helpers are narrower (PainLevel/ScaleLevel) since that's all a *stored*
// entry can be, but an averaged bucket is still an integer in that same
// range, so the cast back is safe here.
const painValueInfo = (value: number) => painLevelInfo(value as PainLevel);
const moodValueInfo = (value: number) => moodLevelInfo(value as ScaleLevel);
const tirednessValueInfo = (value: number) => tirednessLevelInfo(value as ScaleLevel);

function ToggleIconButton({
  Icon,
  label,
  textClass,
  active,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  textClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-full border p-2 transition-colors ${
        active ? "border-brand-green bg-brand-green text-white" : "border-neutral-700 text-neutral-400"
      }`}
    >
      <Icon size={14} strokeWidth={1.75} className={active ? "" : textClass} />
    </button>
  );
}

export function DashboardView() {
  const { getEntry, listEntries } = useEntries();
  const [preset, setPreset] = useState<Preset>("month");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [visibleSeries, setVisibleSeries] = useState<Set<EventKey>>(new Set());
  const [visibleOverlays, setVisibleOverlays] = useState<Set<OverlayMetricKey>>(new Set());
  // Shared crosshair index for Dolor/Cansancio/Ánimo — the three charts are
  // built from the same `dates`/buckets, so one index lines up across all
  // three. Dragging on any of them moves the line on the other two, as if
  // one vertical line ran through all three plots.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function toggleSeries(key: EventKey) {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleOverlay(key: OverlayMetricKey) {
    setVisibleOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const [customStart, setCustomStart] = useState(() => [...lastNDays(7)].at(-1)!);
  const [customEnd, setCustomEnd] = useState(() => todayISO());
  const [appliedCustom, setAppliedCustom] = useState({ start: customStart, end: customEnd });

  const dates = useMemo(() => {
    if (preset === "week") return [...lastNDays(7)].reverse();
    if (preset === "month") return [...lastNDays(30)].reverse();

    const [start, end] =
      appliedCustom.start <= appliedCustom.end
        ? [appliedCustom.start, appliedCustom.end]
        : [appliedCustom.end, appliedCustom.start];
    return datesInRange(start, end).slice(0, MAX_CUSTOM_DAYS);
  }, [preset, appliedCustom]);

  // Index no longer lines up (or no longer means "hovering") once the
  // x-axis itself changes — different range or different bucketing.
  useEffect(() => {
    setActiveIndex(null);
  }, [dates, granularity]);

  const chartData = useMemo(() => {
    if (granularity === "day") {
      const painPoints = dates.map((date) => ({ date, value: getEntry(date)?.painLevel ?? null }));
      const tirednessPoints = dates.map((date) => ({ date, value: getEntry(date)?.tiredness ?? null }));
      const moodPoints = dates.map((date) => ({ date, value: getEntry(date)?.mood ?? null }));
      const periodFlags = dates.map((date) => getEntry(date)?.period ?? false);
      const periodStarts = periodStartDates(listEntries());
      const fertileFlags = dates.map((date) => isFertileWindow(cycleDayOf(date, periodStarts)));
      const ovulationFlags = dates.map((date) => isOvulationDay(cycleDayOf(date, periodStarts)));
      const dayEvents = dates.map((date) => {
        const entry = getEntry(date);
        return {
          sex: entry?.sex ?? false,
          activity: entry ? hasIntenseActivity(entry) : false,
          alcohol: entry?.alcohol ?? false,
        };
      });
      return {
        painPoints,
        tirednessPoints,
        moodPoints,
        periodFlags,
        fertileFlags,
        ovulationFlags,
        dayEvents,
        bucketCounts: undefined,
      };
    }

    const buckets = granularity === "week" ? groupByWeek(dates) : groupByMonth(dates);
    const painPoints = buckets.map(({ date, dates: bucketDates }) => ({
      date,
      value: averageLevel(bucketDates.map((d) => getEntry(d)?.painLevel ?? null)),
    }));
    const tirednessPoints = buckets.map(({ date, dates: bucketDates }) => ({
      date,
      value: averageLevel(bucketDates.map((d) => getEntry(d)?.tiredness ?? null)),
    }));
    const moodPoints = buckets.map(({ date, dates: bucketDates }) => ({
      date,
      value: averageLevel(bucketDates.map((d) => getEntry(d)?.mood ?? null)),
    }));
    const bucketCounts: Record<EventKey, CountPoint[]> = {
      sex: buckets.map(({ date, dates: bucketDates }) => ({
        date,
        count: bucketDates.filter((d) => getEntry(d)?.sex).length,
      })),
      activity: buckets.map(({ date, dates: bucketDates }) => ({
        date,
        count: bucketDates.filter((d) => {
          const entry = getEntry(d);
          return entry ? hasIntenseActivity(entry) : false;
        }).length,
      })),
      alcohol: buckets.map(({ date, dates: bucketDates }) => ({
        date,
        count: bucketDates.filter((d) => getEntry(d)?.alcohol).length,
      })),
    };
    return {
      painPoints,
      tirednessPoints,
      moodPoints,
      periodFlags: undefined,
      fertileFlags: undefined,
      ovulationFlags: undefined,
      dayEvents: undefined,
      bucketCounts,
    };
  }, [dates, granularity, getEntry, listEntries]);

  const overlayPoints: Record<OverlayMetricKey, typeof chartData.tirednessPoints> = {
    tiredness: chartData.tirednessPoints,
    mood: chartData.moodPoints,
  };
  const painOverlays: OverlaySeries[] = OVERLAY_METRIC_ORDER.filter((key) => visibleOverlays.has(key)).map(
    (key) => ({
      key,
      points: overlayPoints[key],
      range: SCALE_RANGE,
      dashed: OVERLAY_METRIC_META[key].dashed,
    }),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-lg font-medium">Dashboard</h1>

      <ChoiceGroup options={PRESETS} value={preset} onChange={setPreset} />

      {preset === "custom" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedCustom({ start: customStart, end: customEnd });
          }}
          className="flex items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Desde
            <input
              type="date"
              value={customStart}
              max={todayISO()}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-transparent px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Hasta
            <input
              type="date"
              value={customEnd}
              max={todayISO()}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-transparent px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white"
          >
            Aplicar
          </button>
        </form>
      )}

      <DashboardGranularityPicker value={granularity} onChange={setGranularity} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-neutral-500">Dolor</h2>
          <div className="flex items-center gap-2">
            {EVENT_ORDER.map((key) => {
              const meta = EVENT_META[key];
              return (
                <ToggleIconButton
                  key={key}
                  Icon={meta.Icon}
                  label={meta.label}
                  textClass={meta.textClass}
                  active={visibleSeries.has(key)}
                  onClick={() => toggleSeries(key)}
                />
              );
            })}
            <div className="mx-0.5 h-6 w-px bg-neutral-800" aria-hidden="true" />
            {OVERLAY_METRIC_ORDER.map((key) => {
              const meta = OVERLAY_METRIC_META[key];
              return (
                <ToggleIconButton
                  key={key}
                  Icon={meta.Icon}
                  label={`Superponer ${meta.label.toLowerCase()}`}
                  textClass={meta.textClass}
                  active={visibleOverlays.has(key)}
                  onClick={() => toggleOverlay(key)}
                />
              );
            })}
          </div>
        </div>
        <MetricChart
          points={chartData.painPoints}
          range={[0, 5]}
          valueInfo={painValueInfo}
          label="Nivel de dolor"
          granularity={granularity}
          periodFlags={chartData.periodFlags}
          fertileFlags={chartData.fertileFlags}
          ovulationFlags={chartData.ovulationFlags}
          dayEvents={chartData.dayEvents}
          bucketCounts={chartData.bucketCounts}
          visibleSeries={visibleSeries}
          overlays={painOverlays}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm text-neutral-500">Cansancio</h2>
        <MetricChart
          points={chartData.tirednessPoints}
          range={SCALE_RANGE}
          valueInfo={tirednessValueInfo}
          label="Cansancio"
          granularity={granularity}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm text-neutral-500">Ánimo</h2>
        <MetricChart
          points={chartData.moodPoints}
          range={SCALE_RANGE}
          valueInfo={moodValueInfo}
          label="Ánimo"
          granularity={granularity}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />
      </div>

      <Link href="/sync" className="mt-auto text-sm text-neutral-500 underline">
        Configurar sincronización
      </Link>
    </div>
  );
}
