import { timingSafeEqual } from "node:crypto";

// Not a cryptographic secret protecting content (the passphrase does that) —
// just a shared bearer token so the sync API isn't publicly readable/writable
// by anyone who finds the deployed URL.
export function requireToken(request: Request): boolean {
  const expected = process.env.SYNC_API_TOKEN;
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const provided = auth.slice("Bearer ".length);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
