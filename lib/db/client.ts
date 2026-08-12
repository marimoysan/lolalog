import initSqlJs, { type Database } from "sql.js";
import { get, set } from "idb-keyval";

const STORAGE_KEY = "lolalog.sqlite";

let dbPromise: Promise<Database> | null = null;

// Browser-only: SQLite runs client-side via WASM, backed by IndexedDB.
// No tables are created here yet — schema lives with the feature that needs it.
export function getDb(): Promise<Database> {
  if (typeof window === "undefined") {
    throw new Error("getDb() can only be called in the browser");
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
      const saved = await get<Uint8Array>(STORAGE_KEY);
      return saved ? new SQL.Database(saved) : new SQL.Database();
    })();
  }

  return dbPromise;
}

// Call after any write so changes survive a reload.
export async function persist(): Promise<void> {
  const db = await getDb();
  const bytes = db.export();
  await set(STORAGE_KEY, bytes);
}
