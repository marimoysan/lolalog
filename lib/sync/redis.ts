import { Redis } from "@upstash/redis";

// The Upstash Redis integration on this Vercel project is namespaced under
// the "lolalog" store name, so it injects lolalog_KV_REST_API_URL /
// lolalog_KV_REST_API_TOKEN (not the unprefixed UPSTASH_REDIS_REST_* names
// Redis.fromEnv() looks for by default) — read the exact names from Vercel
// Project Settings → Environment Variables before changing these.
const url = process.env.lolalog_KV_REST_API_URL;
const token = process.env.lolalog_KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    "Missing lolalog_KV_REST_API_URL / lolalog_KV_REST_API_TOKEN env vars",
  );
}

export const redis = new Redis({ url, token });
