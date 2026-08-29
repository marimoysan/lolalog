// Fills an isolated Chromium profile (.dev-profile/, gitignored) with a
// dummy month of entries, so the Dashboard/Historial can be previewed with
// data without touching the real diary. Sync is never configured in this
// profile, so saveEntry's push is a guaranteed no-op — see
// isSyncConfigured() in lib/sync/key-store.ts.
//
// Requires `npm run dev` running at localhost:3000.
// Re-run any time to reset the dummy month to a fresh random spread.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, "..", ".dev-profile");
const BASE_URL = process.env.LOLALOG_DEV_URL ?? "http://localhost:3000";
const PIN = process.env.NEXT_PUBLIC_LOLALOG_PIN ?? "1234";
const DAYS = 30;

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

// A slow wave (a flare-up cycling over ~2 weeks) plus small per-day jitter,
// so the chart reads as an organic trend instead of pure random noise.
function painFor(n) {
  if (n % 8 === 3) return null; // occasional gap -> "Sin registrar" on the chart
  const wave = 2.1 + 2.1 * Math.sin(n / 4.2);
  const jitter = Math.sin(n * 12.9) * 0.6;
  return clamp(wave + jitter, 0, 5);
}

function moodFor(pain) {
  if (pain === null) return clamp(3 + (Math.random() - 0.5) * 2, 1, 5);
  return clamp(5 - pain * 0.7 + (Math.random() - 0.5), 1, 5);
}

function activityFor(n) {
  return clamp(3 + 1.8 * Math.sin(n / 3 + 1) + (Math.random() - 0.5), 1, 5);
}

function tirednessFor(pain) {
  const base = pain === null ? 3 : 2 + pain * 0.5;
  return clamp(base + (Math.random() - 0.5), 1, 5);
}

// One menstrual-cycle block plus a scatter of yes/no days, inside the
// 30-day window (n = days ago).
const PERIOD_DAYS = new Set([20, 21, 22, 23, 24]);
const SEX_DAYS = new Set([2, 9, 16, 27]);
const ALCOHOL_DAYS = new Set([1, 6, 13, 19, 26]);

async function clickPain(page, level) {
  if (level === null) return;
  if (level === 0) {
    await page.getByRole("button", { name: "Sin dolor" }).click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(`^Dolor nivel ${level}:`) }).click();
}

async function clickMood(page, level) {
  await page.getByRole("button", { name: new RegExp(`^Ánimo nivel ${level}:`) }).click();
}

async function clickScale(page, ariaLabelPrefix, level) {
  await page.getByRole("button", { name: `${ariaLabelPrefix} ${level}`, exact: true }).click();
}

async function clickYesNo(page, fieldLabel, value) {
  const field = page.locator("div.flex.flex-col.gap-2", {
    has: page.locator("label", { hasText: fieldLabel }),
  });
  await field.getByRole("button", { name: value, exact: true }).click();
}

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

// PIN gate is a dialpad (tapped, not typed) and only attaches its keydown
// listener once the WASM DB has hydrated — sending keys before then is a
// silent no-op, so wait for the actual digit button rather than a fixed
// timeout. sessionStorage-backed unlock doesn't survive this script's
// browser closing between runs, so the dialpad reappears every run.
const firstDigit = page.getByRole("button", { name: "Dígito 1" });
if (await firstDigit.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)) {
  for (const digit of PIN) {
    await page.getByRole("button", { name: `Dígito ${digit}` }).click();
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);
}

for (let n = DAYS - 1; n >= 0; n--) {
  const date = isoDaysAgo(n);
  const pain = painFor(n);

  await page.goto(n === 0 ? `${BASE_URL}/` : `${BASE_URL}/history/${date}`);
  // Each full navigation re-boots the sql.js/IndexedDB client, so wait for
  // the form to actually be there instead of guessing a fixed delay.
  await page.getByRole("button", { name: "Sin dolor" }).waitFor({ timeout: 15000 });

  await clickPain(page, pain);
  await clickMood(page, moodFor(pain));
  await clickScale(page, "Actividad", activityFor(n));
  await clickScale(page, "Cansancio", tirednessFor(pain));
  if (PERIOD_DAYS.has(n)) await clickYesNo(page, "Regla", "Sí");
  if (SEX_DAYS.has(n)) await clickYesNo(page, "Relaciones sexuales", "Sí");
  if (ALCOHOL_DAYS.has(n)) await clickYesNo(page, "Alcohol", "Sí");

  if (n === 0) {
    await page.waitForTimeout(1000); // today autosaves on a debounce
  } else {
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForTimeout(120);
  }
}

await page.goto(`${BASE_URL}/dashboard`);
await page.waitForTimeout(300);

console.log(`Dummy month seeded into ${PROFILE_DIR}`);
console.log("Browser left open on the Dashboard — close the window when done.");
