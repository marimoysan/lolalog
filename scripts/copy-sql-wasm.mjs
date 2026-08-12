// Copies the sql.js WASM binaries into public/ so they can be fetched at
// runtime. Runs automatically via the "postinstall" npm script.
//
// sql.js ships two builds: sql-wasm.js (Node) and sql-wasm-browser.js
// (browser, picked by Next's "browser" export condition — see the
// "exports" field in node_modules/sql.js/package.json). Each loads its own
// same-named .wasm file, so both need to be present in public/.
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, "..", "node_modules", "sql.js", "dist");
const destDir = path.join(root, "..", "public");
const files = ["sql-wasm.wasm", "sql-wasm-browser.wasm"];

await mkdir(destDir, { recursive: true });
await Promise.all(
  files.map((file) => copyFile(path.join(distDir, file), path.join(destDir, file))),
);
console.log(`Copied ${files.join(", ")} to public/`);
