/**
 * Static-export build for GitHub Pages.
 *
 * `output: "export"` cannot compile dynamic route handlers, and the Vercel cron
 * endpoint (`app/api/cron/sync`) is intentionally dynamic (it reads auth headers
 * and request params). On GitHub Pages there is no server to run it — ingestion
 * happens in a scheduled GitHub Action instead — so we move the `app/api` tree
 * aside for the duration of the export, then always restore it.
 *
 * Run via `npm run build:static`. Sets STATIC_EXPORT so next.config.mjs switches
 * to export mode (output:export + basePath + unoptimized images).
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "app", "api");
const apiBak = join(root, "app", "_api.export-bak");

let moved = false;
if (existsSync(apiDir)) {
  renameSync(apiDir, apiBak);
  moved = true;
}

function restore() {
  if (moved && existsSync(apiBak)) {
    renameSync(apiBak, apiDir);
    moved = false;
  }
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "true" },
});

restore();
process.exit(result.status ?? 1);
