import { LogForm } from "@/components/LogForm";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HistoryDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return <LogForm date={date} isToday={date === todayISO()} />;
}
