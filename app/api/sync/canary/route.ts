import { NextResponse } from "next/server";
import { redis } from "@/lib/sync/redis";
import { requireToken } from "@/lib/sync/api-auth";
import type { CanaryBlob } from "@/lib/sync/types";

export const runtime = "nodejs";

const CANARY_KEY = "lolalog:canary";
const MAX_BLOB_SIZE = 50_000;

export async function PUT(request: Request) {
  if (!requireToken(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<CanaryBlob>;
  const valid =
    typeof body.iv === "string" &&
    body.iv.length > 0 &&
    typeof body.ciphertext === "string" &&
    body.ciphertext.length > 0 &&
    body.ciphertext.length <= MAX_BLOB_SIZE;

  if (!valid) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // Set-if-absent: never overwrite an existing canary — that would silently
  // redefine "the correct passphrase" and mask a real mismatch elsewhere.
  const result = await redis.set(CANARY_KEY, body as CanaryBlob, { nx: true });
  return NextResponse.json({ applied: result === "OK" });
}
