import { LogForm } from "@/components/LogForm";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function Home() {
  return <LogForm date={todayISO()} isToday />;
}
