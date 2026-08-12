import { HistoryList } from "@/components/HistoryList";
import { lastNDays } from "@/lib/date";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 30;

export default function HistoryPage() {
  return <HistoryList days={lastNDays(DAYS_SHOWN)} />;
}
