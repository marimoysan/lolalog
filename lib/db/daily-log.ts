import type { Database } from "sql.js";
import type {
  DailyEntry,
  FoodQuality,
  FoodQuantity,
  PainLevel,
  ScaleLevel,
} from "@/lib/types";

export function initDailyLogSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      pain_level INTEGER NOT NULL,
      pain_locations TEXT NOT NULL DEFAULT '[]',
      activity_level INTEGER,
      lie_down_need INTEGER,
      sports TEXT NOT NULL DEFAULT '[]',
      period INTEGER NOT NULL DEFAULT 0,
      sex INTEGER NOT NULL DEFAULT 0,
      food_quantity TEXT,
      food_quality TEXT,
      food_tags TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )
  `);
}

function rowToEntry(row: Record<string, unknown>): DailyEntry {
  return {
    date: row.date as string,
    painLevel: row.pain_level as PainLevel,
    painLocations: JSON.parse(row.pain_locations as string),
    activityLevel: row.activity_level as ScaleLevel | null,
    lieDownNeed: row.lie_down_need as ScaleLevel | null,
    sports: JSON.parse(row.sports as string),
    period: Boolean(row.period),
    sex: Boolean(row.sex),
    food: {
      quantity: row.food_quantity as FoodQuantity | null,
      quality: row.food_quality as FoodQuality | null,
      tags: JSON.parse(row.food_tags as string),
    },
  };
}

export function getAllEntries(db: Database): Record<string, DailyEntry> {
  const result = db.exec("SELECT * FROM daily_log");
  const entries: Record<string, DailyEntry> = {};
  if (result.length === 0) return entries;

  const { columns, values } = result[0];
  for (const row of values) {
    const record: Record<string, unknown> = {};
    columns.forEach((col, i) => (record[col] = row[i]));
    const entry = rowToEntry(record);
    entries[entry.date] = entry;
  }
  return entries;
}

// updatedAt defaults to now, but sync passes the remote's own timestamp when
// applying a pulled row — otherwise every merge would re-stamp "now" and
// make the local copy look newer than the server on the very next sync.
export function upsertEntry(
  db: Database,
  entry: DailyEntry,
  updatedAt: string = new Date().toISOString(),
): string {
  db.run(
    `INSERT OR REPLACE INTO daily_log
      (date, pain_level, pain_locations, activity_level, lie_down_need,
       sports, period, sex, food_quantity, food_quality, food_tags, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date,
      entry.painLevel,
      JSON.stringify(entry.painLocations),
      entry.activityLevel,
      entry.lieDownNeed,
      JSON.stringify(entry.sports),
      entry.period ? 1 : 0,
      entry.sex ? 1 : 0,
      entry.food.quantity,
      entry.food.quality,
      JSON.stringify(entry.food.tags),
      updatedAt,
    ],
  );
  return updatedAt;
}

export function getUpdatedAtMap(db: Database): Record<string, string> {
  const result = db.exec("SELECT date, updated_at FROM daily_log");
  const map: Record<string, string> = {};
  if (result.length === 0) return map;

  const { values } = result[0];
  for (const [date, updatedAt] of values) {
    map[date as string] = updatedAt as string;
  }
  return map;
}
