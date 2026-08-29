"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { PainChart } from "@/components/PainChart";
import { useEntries } from "@/lib/db/entries-store";
import { datesInRange, lastNDays, todayISO } from "@/lib/date";

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
  const { getEntry } = useEntries();
  const [preset, setPreset] = useState<Preset>("month");

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

  const points = dates.map((date) => ({ date, painLevel: getEntry(date)?.painLevel ?? null }));

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

      <div className="flex flex-col gap-2">
        <h2 className="text-sm text-neutral-500">Dolor</h2>
        <PainChart points={points} />
      </div>

      <Link href="/sync" className="mt-auto text-sm text-neutral-500 underline">
        Configurar sincronización
      </Link>
    </div>
  );
}
