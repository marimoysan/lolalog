"use client";

// Real persistence: SQLite (sql.js) in the browser, backed by IndexedDB.
// See lib/db/client.ts (open/persist) and lib/db/daily-log.ts (schema/queries).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDb, persist } from "@/lib/db/client";
import {
  deleteEntry as deleteEntryRow,
  getAllEntries,
  initDailyLogSchema,
  migrateAlcoholTag,
  upsertEntry,
} from "@/lib/db/daily-log";
import { syncOnLoad, syncPush, syncPushDelete } from "@/lib/sync/sync";
import type { DailyEntry } from "@/lib/types";

type EntriesContextValue = {
  getEntry: (date: string) => DailyEntry | undefined;
  // All entries regardless of date range — used e.g. to find period starts
  // from anywhere in history, not just the Dashboard's visible window.
  listEntries: () => DailyEntry[];
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
      const loaded = getAllEntries(db);

      // One-time-per-entry data migration: pull "Alcohol" out of any old
      // food.tags into the new alcohol field. Runs before first paint so
      // the UI never shows the pre-migration shape.
      let migratedAny = false;
      for (const [date, entry] of Object.entries(loaded)) {
        const migrated = migrateAlcoholTag(entry);
        if (!migrated) continue;
        loaded[date] = migrated;
        migratedAny = true;
        const updatedAt = upsertEntry(db, migrated);
        syncPush(migrated, updatedAt).catch(() => {});
      }
      if (migratedAny) await persist();

      setEntries(loaded);
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

  function listEntries() {
    return Object.values(entries);
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
    <EntriesContext.Provider value={{ getEntry, listEntries, saveEntry, deleteEntry }}>
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries() {
  const ctx = useContext(EntriesContext);
  if (!ctx) throw new Error("useEntries must be used within EntriesProvider");
  return ctx;
}
