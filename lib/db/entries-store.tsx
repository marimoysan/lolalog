"use client";

// Real persistence: SQLite (sql.js) in the browser, backed by IndexedDB.
// See lib/db/client.ts (open/persist) and lib/db/daily-log.ts (schema/queries).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDb, persist } from "@/lib/db/client";
import {
  deleteEntry as deleteEntryRow,
  getAllEntries,
  initDailyLogSchema,
  upsertEntry,
} from "@/lib/db/daily-log";
import { syncOnLoad, syncPush, syncPushDelete } from "@/lib/sync/sync";
import type { DailyEntry } from "@/lib/types";

type EntriesContextValue = {
  getEntry: (date: string) => DailyEntry | undefined;
  saveEntry: (entry: DailyEntry) => void;
  deleteEntry: (date: string) => void;
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

      // Runs after setReady(true): never blocks first paint or offline use.
      syncOnLoad(db)
        .then((result) => {
          if (!result.ok) return;
          if (result.appliedCount === 0 && result.deletedDates.length === 0) return;
          setEntries((prev) => {
            const next = { ...prev, ...result.entries };
            for (const date of result.deletedDates) delete next[date];
            return next;
          });
        })
        .catch(() => {});
    })();
  }, []);

  function getEntry(date: string) {
    return entries[date];
  }

  function saveEntry(entry: DailyEntry) {
    setEntries((prev) => ({ ...prev, [entry.date]: entry }));
    (async () => {
      const db = await getDb();
      const updatedAt = upsertEntry(db, entry);
      await persist();
      syncPush(entry, updatedAt).catch(() => {});
    })();
  }

  function deleteEntry(date: string) {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    (async () => {
      const db = await getDb();
      const updatedAt = deleteEntryRow(db, date);
      await persist();
      syncPushDelete(date, updatedAt).catch(() => {});
    })();
  }

  if (!ready) return null;

  return (
    <EntriesContext.Provider value={{ getEntry, saveEntry, deleteEntry }}>
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries() {
  const ctx = useContext(EntriesContext);
  if (!ctx) throw new Error("useEntries must be used within EntriesProvider");
  return ctx;
}
