import { formatDateParts } from "@/lib/date";

export function DateHeader({ date, isToday = true }: { date: string; isToday?: boolean }) {
  const { weekday, day, month, year } = formatDateParts(date);

  return (
    <div className="flex flex-col items-center py-4">
      <span className="text-sm text-neutral-500">{weekday}</span>
      <span
        className={`text-7xl font-bold leading-none ${
          isToday ? "text-brand-green" : "text-foreground"
        }`}
      >
        {day}
      </span>
      <div className="mt-1 flex flex-col items-center leading-tight">
        <span className="text-xl text-neutral-500">{month}</span>
        <span className="text-sm text-neutral-500">{year}</span>
      </div>
    </div>
  );
}
