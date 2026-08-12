"use client";

// One-time-per-device sync config: the derived AES key (never the
// passphrase itself — it can't be re-shown once this session ends) and the
// API bearer token, both persisted in IndexedDB via idb-keyval.

import { get, set } from "idb-keyval";

const KEY_STORAGE_KEY = "lolalog.sync.key";
const TOKEN_STORAGE_KEY = "lolalog.sync.token";

export async function storeKey(key: CryptoKey): Promise<void> {
  await set(KEY_STORAGE_KEY, key);
}

export function loadKey(): Promise<CryptoKey | undefined> {
  return get<CryptoKey>(KEY_STORAGE_KEY);
}

export async function storeToken(token: string): Promise<void> {
  await set(TOKEN_STORAGE_KEY, token);
}

export function loadToken(): Promise<string | undefined> {
  return get<string>(TOKEN_STORAGE_KEY);
}

export async function isSyncConfigured(): Promise<boolean> {
  const [key, token] = await Promise.all([loadKey(), loadToken()]);
  return Boolean(key && token);
}
