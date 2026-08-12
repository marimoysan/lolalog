import { formatDateParts } from "@/lib/date";

export function DateHeader({ date }: { date: string }) {
  const { day, month, year } = formatDateParts(date);

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <span className="text-7xl font-bold leading-none text-brand-green">{day}</span>
      <span className="text-xl text-neutral-500">{month}</span>
      <span className="text-sm text-neutral-500">{year}</span>
    </div>
  );
}
