"use client";

import Link from "next/link";
import { useEntries } from "@/lib/db/entries-store";
import { formatDisplayDate, todayISO } from "@/lib/date";
import { painLevelInfo } from "@/lib/pain-scale";
import type { DailyEntry } from "@/lib/types";

function EntryStatus({ entry }: { entry: DailyEntry | undefined }) {
  if (!entry) {
    return <span className="text-sm text-neutral-500">Sin registrar</span>;
  }

  const { Icon, label, textClass } = painLevelInfo(entry.painLevel);
  return (
    <span className={`flex items-center gap-1.5 text-sm ${textClass}`}>
      <Icon size={18} strokeWidth={1.75} />
      {entry.painLevel === 0 ? label : entry.painLevel}
    </span>
  );
}

export function HistoryList({ days }: { days: string[] }) {
  const { getEntry } = useEntries();
  const today = todayISO();

  return (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h1 className="mb-1 text-lg font-medium">Historial</h1>
      {days.map((date) => {
        const entry = getEntry(date);
        return (
          <Link
            key={date}
            href={date === today ? "/" : `/history/${date}`}
            className="flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-3 text-sm text-foreground no-underline transition-colors hover:border-brand-green/40"
          >
            <span className="capitalize">{formatDisplayDate(date)}</span>
            <EntryStatus entry={entry} />
          </Link>
        );
      })}
    </div>
  );
}
