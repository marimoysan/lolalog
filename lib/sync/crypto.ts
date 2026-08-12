"use client";

// End-to-end encryption for sync: the server only ever sees these
// ciphertext blobs, never the plaintext DailyEntry content. See
// lib/sync/README.md for the full design.

import type { DailyEntry } from "@/lib/types";

// Fixed, non-secret app-level salt. Must be identical across every device
// for the same passphrase to derive the same key — it can't be per-device
// random the way a salt normally would be for many-user password storage.
const SALT = new TextEncoder().encode("lolalog-sync-v1");
const PBKDF2_ITERATIONS = 250_000;
const CANARY_PLAINTEXT = "lolalog-sync-canary";

export type EncryptedBlob = { iv: string; ciphertext: string };

export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

async function encryptJSON(key: CryptoKey, data: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: bufToBase64(iv.buffer), ciphertext: bufToBase64(ciphertext) };
}

async function decryptJSON<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const iv = new Uint8Array(base64ToBuf(blob.iv));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBuf(blob.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

// date/updated_at stay outside the ciphertext — the server needs them in the
// clear to key rows and arbitrate last-write-wins without ever decrypting.
type EncryptedEntryPayload = Omit<DailyEntry, "date">;

export function encryptEntry(key: CryptoKey, { date, ...payload }: DailyEntry): Promise<EncryptedBlob> {
  void date;
  return encryptJSON(key, payload);
}

export async function decryptEntry(
  key: CryptoKey,
  date: string,
  blob: EncryptedBlob,
): Promise<DailyEntry> {
  const payload = await decryptJSON<EncryptedEntryPayload>(key, blob);
  return { date, ...payload };
}

export function encryptCanary(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptJSON(key, CANARY_PLAINTEXT);
}

// Never throws — a wrong passphrase must be a clean false, not an exception
// that could accidentally skip the "abort the whole sync" check upstream.
export async function decryptCanaryOk(key: CryptoKey, blob: EncryptedBlob): Promise<boolean> {
  try {
    const value = await decryptJSON<string>(key, blob);
    return value === CANARY_PLAINTEXT;
  } catch {
    return false;
  }
}
