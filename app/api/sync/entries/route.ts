import { NextResponse } from "next/server";
import { redis } from "@/lib/sync/redis";
import { requireToken } from "@/lib/sync/api-auth";
import type { CanaryBlob, RemoteRow } from "@/lib/sync/types";

// crypto.timingSafeEqual (used by requireToken) needs the Node runtime —
// not available on Edge.
export const runtime = "nodejs";

const ENTRIES_KEY = "lolalog:entries";
const CANARY_KEY = "lolalog:canary";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BLOB_SIZE = 50_000;

type StoredEntry =
  | { updatedAt: string; iv: string; ciphertext: string; deleted?: false }
  | { updatedAt: string; deleted: true };

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!requireToken(request)) return unauthorized();

  const [hash, canary] = await Promise.all([
    redis.hgetall<Record<string, StoredEntry>>(ENTRIES_KEY),
    redis.get<CanaryBlob>(CANARY_KEY),
  ]);

  const entries: RemoteRow[] = Object.entries(hash ?? {}).map(([date, row]) => ({
    date,
    ...row,
  }));

  return NextResponse.json({ entries, canary: canary ?? null });
}

export async function POST(request: Request) {
  if (!requireToken(request)) return unauthorized();

  const body = (await request.json()) as Partial<RemoteRow>;
  const baseValid =
    typeof body.date === "string" &&
    DATE_RE.test(body.date) &&
    typeof body.updatedAt === "string" &&
    !Number.isNaN(Date.parse(body.updatedAt));

  const isDelete = body.deleted === true;
  // A tombstone carries no content, so it skips the iv/ciphertext checks
  // that every real entry still has to pass.
  const valid =
    baseValid &&
    (isDelete ||
      (typeof body.iv === "string" &&
        body.iv.length > 0 &&
        typeof body.ciphertext === "string" &&
        body.ciphertext.length > 0 &&
        body.ciphertext.length <= MAX_BLOB_SIZE));

  if (!valid) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const row = body as RemoteRow;

  // Last-write-wins upsert, arbitrated here without ever decrypting the
  // ciphertext — ISO timestamps sort lexicographically the same as
  // chronologically, so string comparison is safe.
  const current = await redis.hget<StoredEntry>(ENTRIES_KEY, row.date);
  if (current && current.updatedAt >= row.updatedAt) {
    return NextResponse.json({ applied: false });
  }

  const stored: StoredEntry = isDelete
    ? { updatedAt: row.updatedAt, deleted: true }
    : { updatedAt: row.updatedAt, iv: row.iv!, ciphertext: row.ciphertext! };

  await redis.hset(ENTRIES_KEY, { [row.date]: stored });
  return NextResponse.json({ applied: true });
}
