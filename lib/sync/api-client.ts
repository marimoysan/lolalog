"use client";

import { loadToken } from "@/lib/sync/key-store";
import type { CanaryBlob, RemoteRow } from "@/lib/sync/types";

export class SyncAuthError extends Error {
  constructor() {
    super("Sync token missing or rejected");
    this.name = "SyncAuthError";
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await loadToken();
  if (!token) throw new SyncAuthError();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new SyncAuthError();
  if (!res.ok) throw new Error(`Sync request failed: ${res.status}`);
  return res.json();
}

export async function pullRemote(): Promise<{ entries: RemoteRow[]; canary: CanaryBlob | null }> {
  const res = await fetch("/api/sync/entries", { headers: await authHeaders() });
  return handle(res);
}

export async function pushRemote(row: RemoteRow): Promise<void> {
  const res = await fetch("/api/sync/entries", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(row),
  });
  await handle(res);
}

export async function pushCanary(canary: CanaryBlob): Promise<void> {
  const res = await fetch("/api/sync/canary", {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(canary),
  });
  await handle(res);
}
