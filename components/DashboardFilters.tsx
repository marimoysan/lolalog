"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { EVENT_META, EVENT_ORDER, type EventKey } from "@/lib/event-icons";

// Icon button that reveals an inline panel of togglable series (sex,
// activity, alcohol) to overlay on the Dashboard chart — same "tap to
// reveal a panel below the trigger" pattern as the Custom date-range form
// and TagCloud's hints, rather than a floating popover. Period isn't here:
// it's always shown as background shading, not an opt-in series.
export function DashboardFilters({
  visible,
  onToggle,
}: {
  visible: Set<EventKey>;
  onToggle: (key: EventKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Filtros de la gráfica"
        aria-expanded={open}
        className={`flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          open || visible.size > 0
            ? "border-brand-green text-brand-green"
            : "border-neutral-700 text-neutral-400"
        }`}
      >
        <SlidersHorizontal size={14} strokeWidth={1.75} />
        Filtros
        {visible.size > 0 && <span className="text-xs">({visible.size})</span>}
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-800 p-3">
          {EVENT_ORDER.map((key) => {
            const meta = EVENT_META[key];
            const active = visible.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggle(key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-neutral-700 text-neutral-400"
                }`}
              >
                <meta.Icon size={14} strokeWidth={1.75} className={active ? "" : meta.textClass} />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
