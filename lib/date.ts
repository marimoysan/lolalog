export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDisplayDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDateParts(iso: string): {
  day: string;
  month: string;
  year: string;
} {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.toLocaleDateString("es-ES", { day: "numeric" });
  const month = date.toLocaleDateString("es-ES", { month: "long" });
  const year = date.toLocaleDateString("es-ES", { year: "numeric" });
  return { day, month: month.charAt(0).toUpperCase() + month.slice(1), year };
}

// Most recent day first.
export function lastNDays(n: number, from = new Date()): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
