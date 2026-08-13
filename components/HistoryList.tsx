"use client";

import Link from "next/link";
import { CircleDashed } from "lucide-react";
import { useEntries } from "@/lib/db/entries-store";
import { formatDayMonth, formatDisplayDate, todayISO, yesterdayISO } from "@/lib/date";
import { painLevelInfo } from "@/lib/pain-scale";
import { dayBadges, BADGE_CLASS } from "@/lib/day-badges";
import type { DailyEntry } from "@/lib/types";

function DayBadges({ entry }: { entry: DailyEntry | undefined }) {
  if (!entry) return null;
  return (
    <>
      {dayBadges(entry).map((badge) => (
        <span key={badge.key} title={badge.label} className={BADGE_CLASS}>
          <badge.Icon size={14} strokeWidth={1.75} />
        </span>
      ))}
    </>
  );
}

function PainStatus({ entry }: { entry: DailyEntry | undefined }) {
  if (!entry) {
    return <span className="text-sm text-neutral-500">Sin registrar</span>;
  }

  if (entry.painLevel === null) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-neutral-500">
        <CircleDashed size={18} strokeWidth={1.75} />
        Sin dato
      </span>
    );
  }

  const { Icon, label, textClass } = painLevelInfo(entry.painLevel);
  return (
    <span className={`flex items-center gap-1.5 text-sm ${textClass}`}>
      <Icon size={18} strokeWidth={1.75} />
      {entry.painLevel === 0 ? label : entry.painLevel}
    </span>
  );
}

function dayLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return `Hoy, ${formatDayMonth(date)}`;
  if (date === yesterday) return `Ayer, ${formatDayMonth(date)}`;
  return formatDisplayDate(date);
}

export function HistoryList({ days }: { days: string[] }) {
  const { getEntry } = useEntries();
  const today = todayISO();
  const yesterday = yesterdayISO();

  return (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h1 className="mb-1 text-lg font-medium">Historial</h1>
      {days.map((date, i) => {
        const entry = getEntry(date);
        // Weeks run Mon–Sun, and the list goes most-recent-first, so a
        // Sunday row is always the start (top) of the previous week —
        // mark that boundary so scanning down reads as "week, week, week"
        // instead of one long undifferentiated column of days.
        const isWeekBoundary = i > 0 && new Date(`${date}T00:00:00`).getDay() === 0;
        return (
          <div key={date} className="contents">
            {isWeekBoundary && <div className="my-1 border-t border-brand-green/40" />}
            <Link
              href={date === today ? "/" : `/history/${date}`}
              className="flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-3 text-sm text-foreground no-underline transition-colors hover:border-brand-green/40"
            >
              <span className="flex items-center gap-2">
                <span className="capitalize">{dayLabel(date, today, yesterday)}</span>
                <DayBadges entry={entry} />
              </span>
              <PainStatus entry={entry} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
