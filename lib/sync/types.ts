import type { EncryptedBlob } from "@/lib/sync/crypto";
import type { DailyEntry } from "@/lib/types";

export type RemoteRow = EncryptedBlob & {
  date: string;
  updatedAt: string;
};

export type CanaryBlob = EncryptedBlob;

export type SyncResult =
  | { ok: true; appliedCount: number; entries: Record<string, DailyEntry> }
  | { ok: false; reason: "unconfigured" | "wrong-passphrase" | "auth-error" | "network-error" };
