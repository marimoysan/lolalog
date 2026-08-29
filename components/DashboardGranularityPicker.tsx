"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import type { Granularity } from "@/lib/aggregate";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Diario" },
  { value: "week", label: "Semanal" },
  { value: "month", label: "Mensual" },
];

// Icon button that reveals an inline panel to pick the chart's aggregation
// — same "tap to reveal a panel below the trigger" pattern as
// DashboardFilters, but single-select: picking an option closes the panel
// instead of staying open for further toggles.
export function DashboardGranularityPicker({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = OPTIONS.find((o) => o.value === value)!.label;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Agregación de la gráfica"
        aria-expanded={open}
        className={`flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          open ? "border-brand-green text-brand-green" : "border-neutral-700 text-neutral-400"
        }`}
      >
        <CalendarRange size={14} strokeWidth={1.75} />
        {currentLabel}
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-800 p-3">
          {OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-neutral-700 text-neutral-400"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
