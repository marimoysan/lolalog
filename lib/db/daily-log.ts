import type { Database } from "sql.js";
import type {
  DailyEntry,
  FoodQuality,
  FoodQuantity,
  PainEpisode,
  PainLevel,
  ScaleLevel,
} from "@/lib/types";

export function initDailyLogSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      pain_level INTEGER,
      pain_locations TEXT NOT NULL DEFAULT '[]',
      pain_episodes TEXT NOT NULL DEFAULT '[]',
      activity_level INTEGER,
      lie_down_need INTEGER,
      sports TEXT NOT NULL DEFAULT '[]',
      period INTEGER NOT NULL DEFAULT 0,
      sex INTEGER NOT NULL DEFAULT 0,
      food_quantity TEXT,
      food_quality TEXT,
      food_tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Devices with a DB created before "deleted" existed: CREATE TABLE IF NOT
  // EXISTS above is a no-op for them, so add the column here.
  const tableInfo = db.exec("PRAGMA table_info(daily_log)");
  const columns = tableInfo[0]?.values ?? [];
  const hasDeletedColumn = columns.some((row) => row[1] === "deleted");
  if (!hasDeletedColumn) {
    db.exec("ALTER TABLE daily_log ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
  }
  const hasPainEpisodesColumn = columns.some((row) => row[1] === "pain_episodes");
  if (!hasPainEpisodesColumn) {
    db.exec("ALTER TABLE daily_log ADD COLUMN pain_episodes TEXT NOT NULL DEFAULT '[]'");
  }
  const hasNotesColumn = columns.some((row) => row[1] === "notes");
  if (!hasNotesColumn) {
    db.exec("ALTER TABLE daily_log ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }

  // Devices with a DB created before pain_level was made optional (retro
  // logs without a remembered pain level): SQLite can't relax a NOT NULL
  // constraint with ALTER TABLE, so rebuild the table when it's still set.
  // Runs after the ALTER TABLEs above so daily_log already has every column
  // by the time it's copied into the rebuilt table.
  const painLevelCol = columns.find((row) => row[1] === "pain_level");
  const painLevelIsNotNull = painLevelCol ? painLevelCol[3] === 1 : false;
  if (painLevelIsNotNull) {
    db.exec(`
      CREATE TABLE daily_log_new (
        date TEXT PRIMARY KEY,
        pain_level INTEGER,
        pain_locations TEXT NOT NULL DEFAULT '[]',
        pain_episodes TEXT NOT NULL DEFAULT '[]',
        activity_level INTEGER,
        lie_down_need INTEGER,
        sports TEXT NOT NULL DEFAULT '[]',
        period INTEGER NOT NULL DEFAULT 0,
        sex INTEGER NOT NULL DEFAULT 0,
        food_quantity TEXT,
        food_quality TEXT,
        food_tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.exec(`
      INSERT INTO daily_log_new
        (date, pain_level, pain_locations, pain_episodes, activity_level, lie_down_need,
         sports, period, sex, food_quantity, food_quality, food_tags, notes,
         updated_at, deleted)
      SELECT
        date, pain_level, pain_locations, pain_episodes, activity_level, lie_down_need,
        sports, period, sex, food_quantity, food_quality, food_tags, notes,
        updated_at, deleted
      FROM daily_log
    `);
    db.exec("DROP TABLE daily_log");
    db.exec("ALTER TABLE daily_log_new RENAME TO daily_log");
  }
}

function rowToEntry(row: Record<string, unknown>): DailyEntry {
  return {
    date: row.date as string,
    painLevel: row.pain_level as PainLevel | null,
    painLocations: JSON.parse(row.pain_locations as string),
    painEpisodes: JSON.parse(row.pain_episodes as string) as PainEpisode[],
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
    notes: row.notes as string,
  };
}

export function getAllEntries(db: Database): Record<string, DailyEntry> {
  const result = db.exec("SELECT * FROM daily_log WHERE deleted = 0");
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
      (date, pain_level, pain_locations, pain_episodes, activity_level, lie_down_need,
       sports, period, sex, food_quantity, food_quality, food_tags, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date,
      entry.painLevel,
      JSON.stringify(entry.painLocations),
      JSON.stringify(entry.painEpisodes),
      entry.activityLevel,
      entry.lieDownNeed,
      JSON.stringify(entry.sports),
      entry.period ? 1 : 0,
      entry.sex ? 1 : 0,
      entry.food.quantity,
      entry.food.quality,
      JSON.stringify(entry.food.tags),
      entry.notes,
      updatedAt,
    ],
  );
  return updatedAt;
}

export type SyncState = { updatedAt: string; deleted: boolean };

// Includes deleted (tombstoned) rows and their updated_at — sync needs both
// to arbitrate last-write-wins and to know when a local row should push a
// delete instead of the entry itself.
export function getSyncState(db: Database): Record<string, SyncState> {
  const result = db.exec("SELECT date, updated_at, deleted FROM daily_log");
  const map: Record<string, SyncState> = {};
  if (result.length === 0) return map;

  const { values } = result[0];
  for (const [date, updatedAt, deleted] of values) {
    map[date as string] = { updatedAt: updatedAt as string, deleted: Boolean(deleted) };
  }
  return map;
}

// Soft delete: marks the row instead of dropping it, so updated_at survives
// for last-write-wins comparisons the same way a normal edit would.
export function deleteEntry(
  db: Database,
  date: string,
  updatedAt: string = new Date().toISOString(),
): string {
  db.run(
    `INSERT INTO daily_log (date, pain_level, updated_at, deleted)
     VALUES (?, NULL, ?, 1)
     ON CONFLICT(date) DO UPDATE SET updated_at = excluded.updated_at, deleted = 1`,
    [date, updatedAt],
  );
  return updatedAt;
}
