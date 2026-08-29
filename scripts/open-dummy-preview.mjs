// Reopens the dummy-data profile created by seed-dummy-month.mjs on the
// Dashboard, without re-seeding — for whenever you just want another look.
// Requires `npm run dev` running at localhost:3000.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, "..", ".dev-profile");
const BASE_URL = process.env.LOLALOG_DEV_URL ?? "http://localhost:3000";
const PIN = process.env.NEXT_PUBLIC_LOLALOG_PIN ?? "1234";

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 420, height: 900 },
  // Playwright's Chromium doesn't inherit the OS theme — the app's dark
  // mode is a pure `prefers-color-scheme` media query (see globals.css), so
  // without this it always renders light regardless of Windows' setting.
  colorScheme: "dark",
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(BASE_URL);

// sessionStorage-backed unlock doesn't survive the browser closing between
// runs, so the PIN dialpad reappears every time — same wait-for-hydration
// caveat as seed-dummy-month.mjs (sending keys before the app hydrates is a
// silent no-op).
const firstDigit = page.getByRole("button", { name: "Dígito 1" });
if (await firstDigit.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)) {
  for (const digit of PIN) {
    await page.getByRole("button", { name: `Dígito ${digit}` }).click();
    await page.waitForTimeout(80);
  }
}

await page.goto(`${BASE_URL}/dashboard`);

console.log("Opened the dummy-data profile on the Dashboard. Close the window when done.");
