"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { DashboardFilters } from "@/components/DashboardFilters";
import { DashboardGranularityPicker } from "@/components/DashboardGranularityPicker";
import { PainChart } from "@/components/PainChart";
import { useEntries } from "@/lib/db/entries-store";
import { datesInRange, lastNDays, todayISO } from "@/lib/date";
import { averagePainLevel, groupByMonth, groupByWeek, type CountPoint, type Granularity } from "@/lib/aggregate";
import { hasIntenseActivity } from "@/lib/day-badges";
import { cycleDayOf, isFertileWindow, isOvulationDay, periodStartDates } from "@/lib/cycle";
import type { EventKey } from "@/lib/event-icons";

type Preset = "week" | "month" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
  { value: "custom", label: "Custom" },
];

// Sane upper bound for a custom range so a typo'd year can't try to render
// thousands of points.
const MAX_CUSTOM_DAYS = 366;

export function DashboardView() {
  const { getEntry, listEntries } = useEntries();
  const [preset, setPreset] = useState<Preset>("month");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [visibleSeries, setVisibleSeries] = useState<Set<EventKey>>(new Set());

  function toggleSeries(key: EventKey) {
    setVisibleSeries((prev) => {
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

  const chartData = useMemo(() => {
    if (granularity === "day") {
      const points = dates.map((date) => ({ date, painLevel: getEntry(date)?.painLevel ?? null }));
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
      return { points, periodFlags, fertileFlags, ovulationFlags, dayEvents, bucketCounts: undefined };
    }

    const buckets = granularity === "week" ? groupByWeek(dates) : groupByMonth(dates);
    const points = buckets.map(({ date, dates: bucketDates }) => ({
      date,
      painLevel: averagePainLevel(bucketDates.map((d) => getEntry(d)?.painLevel ?? null)),
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
      points,
      periodFlags: undefined,
      fertileFlags: undefined,
      ovulationFlags: undefined,
      dayEvents: undefined,
      bucketCounts,
    };
  }, [dates, granularity, getEntry, listEntries]);

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

      <div className="flex gap-2">
        <DashboardGranularityPicker value={granularity} onChange={setGranularity} />
        <DashboardFilters visible={visibleSeries} onToggle={toggleSeries} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm text-neutral-500">Dolor</h2>
        <PainChart
          points={chartData.points}
          granularity={granularity}
          periodFlags={chartData.periodFlags}
          fertileFlags={chartData.fertileFlags}
          ovulationFlags={chartData.ovulationFlags}
          dayEvents={chartData.dayEvents}
          bucketCounts={chartData.bucketCounts}
          visibleSeries={visibleSeries}
        />
      </div>

      <Link href="/sync" className="mt-auto text-sm text-neutral-500 underline">
        Configurar sincronización
      </Link>
    </div>
  );
}
