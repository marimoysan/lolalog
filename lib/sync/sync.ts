"use client";

import type { Database } from "sql.js";
import { deleteEntry, getAllEntries, getSyncState, upsertEntry } from "@/lib/db/daily-log";
import { persist } from "@/lib/db/client";
import { decryptCanaryOk, decryptEntry, encryptCanary, encryptEntry } from "@/lib/sync/crypto";
import { isSyncConfigured, loadKey } from "@/lib/sync/key-store";
import { pullRemote, pushCanary, pushRemote, SyncAuthError } from "@/lib/sync/api-client";
import type { DailyEntry } from "@/lib/types";
import type { SyncResult } from "@/lib/sync/types";

export async function syncPush(entry: DailyEntry, updatedAt: string): Promise<void> {
  if (!(await isSyncConfigured())) return;
  const key = await loadKey();
  if (!key) return;
  const blob = await encryptEntry(key, entry);
  await pushRemote({ date: entry.date, updatedAt, ...blob });
}

export async function syncPushDelete(date: string, updatedAt: string): Promise<void> {
  if (!(await isSyncConfigured())) return;
  if (!(await loadKey())) return;
  await pushRemote({ date, updatedAt, deleted: true });
}

export async function syncOnLoad(db: Database): Promise<SyncResult> {
  if (!(await isSyncConfigured())) return { ok: false, reason: "unconfigured" };
  const key = await loadKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  let pulled;
  try {
    pulled = await pullRemote();
  } catch (err) {
    return { ok: false, reason: err instanceof SyncAuthError ? "auth-error" : "network-error" };
  }
  const { entries: remoteRows, canary } = pulled;

  // A canary already exists on the server: verify this device's passphrase
  // decrypts it before touching anything, local or remote. Skipping this
  // would let a mistyped passphrase silently re-encrypt and push every
  // local row under the wrong key on every load, corrupting the shared data
  // for every other, correctly-configured device.
  if (canary) {
    const canaryOk = await decryptCanaryOk(key, canary);
    if (!canaryOk) return { ok: false, reason: "wrong-passphrase" };
  }

  const localState = getSyncState(db);
  const applied: Record<string, DailyEntry> = {};
  const deletedDates: string[] = [];

  for (const row of remoteRows) {
    const local = localState[row.date];
    if (local && local.updatedAt >= row.updatedAt) continue;
    if (row.deleted) {
      deleteEntry(db, row.date, row.updatedAt);
      deletedDates.push(row.date);
      continue;
    }
    try {
      const entry = await decryptEntry(key, row.date, { iv: row.iv!, ciphertext: row.ciphertext! });
      upsertEntry(db, entry, row.updatedAt);
      applied[row.date] = entry;
    } catch {
      // one corrupted/undecryptable row — skip it, keep syncing the rest
    }
  }

  if (Object.keys(applied).length > 0 || deletedDates.length > 0) {
    await persist();
  }

  const freshLocalState = getSyncState(db);
  const remoteUpdatedAt = new Map(remoteRows.map((row) => [row.date, row.updatedAt]));
  const allEntries = getAllEntries(db);

  for (const [date, { updatedAt, deleted }] of Object.entries(freshLocalState)) {
    const remote = remoteUpdatedAt.get(date);
    if (remote && remote >= updatedAt) continue;
    if (deleted) {
      await pushRemote({ date, updatedAt, deleted: true }).catch(() => {});
      continue;
    }
    const entry = allEntries[date];
    if (!entry) continue;
    const blob = await encryptEntry(key, entry);
    await pushRemote({ date, updatedAt, ...blob }).catch(() => {});
  }

  if (!canary) {
    await pushCanary(await encryptCanary(key)).catch(() => {});
  }

  return { ok: true, appliedCount: Object.keys(applied).length, entries: applied, deletedDates };
}
