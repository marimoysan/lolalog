"use client";

// Real persistence: SQLite (sql.js) in the browser, backed by IndexedDB.
// See lib/db/client.ts (open/persist) and lib/db/daily-log.ts (schema/queries).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDb, persist } from "@/lib/db/client";
import { getAllEntries, initDailyLogSchema, upsertEntry } from "@/lib/db/daily-log";
import type { DailyEntry } from "@/lib/types";

type EntriesContextValue = {
  getEntry: (date: string) => DailyEntry | undefined;
  saveEntry: (entry: DailyEntry) => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({});

  useEffect(() => {
    (async () => {
      const db = await getDb();
      initDailyLogSchema(db);
      setEntries(getAllEntries(db));
      setReady(true);
    })();
  }, []);

  function getEntry(date: string) {
    return entries[date];
  }

  function saveEntry(entry: DailyEntry) {
    setEntries((prev) => ({ ...prev, [entry.date]: entry }));
    (async () => {
      const db = await getDb();
      upsertEntry(db, entry);
      await persist();
    })();
  }

  if (!ready) return null;

  return (
    <EntriesContext.Provider value={{ getEntry, saveEntry }}>
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries() {
  const ctx = useContext(EntriesContext);
  if (!ctx) throw new Error("useEntries must be used within EntriesProvider");
  return ctx;
}
