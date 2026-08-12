import type { EncryptedBlob } from "@/lib/sync/crypto";
import type { DailyEntry } from "@/lib/types";

// A tombstone (deleted: true) carries no content, so iv/ciphertext are
// omitted for it — date/updatedAt/deleted are enough to propagate a delete
// through last-write-wins, same as the server already does for entries.
export type RemoteRow = {
  date: string;
  updatedAt: string;
  deleted?: boolean;
  iv?: string;
  ciphertext?: string;
};

export type CanaryBlob = EncryptedBlob;

export type SyncResult =
  | {
      ok: true;
      appliedCount: number;
      entries: Record<string, DailyEntry>;
      deletedDates: string[];
    }
  | { ok: false; reason: "unconfigured" | "wrong-passphrase" | "auth-error" | "network-error" };
