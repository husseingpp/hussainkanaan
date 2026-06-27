/**
 * Ingestion runner for the GitHub Pages deployment.
 *
 * On Vercel the scheduled sync runs through the cron route handler
 * (`app/api/cron/sync`). GitHub Pages has no server, so the scheduled GitHub
 * Action (`.github/workflows/congresstracker-ingest.yml`) runs this script
 * instead. It mirrors the cron route: a cheap incremental members sync plus a
 * scores refresh, both idempotent (safe to re-run).
 *
 *   npx tsx scripts/sync.ts members,scores
 *
 * Heavier jobs (bills, votes) cost far more of the ~5,000 req/day Congress.gov
 * budget and are run manually, not on the schedule.
 */
import { ingestMembers } from "../ingest/members.ts";
import { ingestScores } from "../ingest/scores.ts";
import { currentCongress } from "../lib/constants.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.CONGRESS_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // No secrets configured (e.g. a fork running the schedule) — no-op, don't fail.
  console.warn("Missing Supabase env (URL / service-role key) — skipping sync.");
  process.exit(0);
}

const tasks = (process.argv[2] ?? process.env.SYNC_TASKS ?? "members,scores")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const congress = Number(process.env.CURRENT_CONGRESS) || currentCongress();

async function main() {
  console.log(`Sync starting — congress ${congress}, tasks: ${tasks.join(", ")}`);

  if (tasks.includes("members")) {
    if (!apiKey) {
      console.warn("CONGRESS_API_KEY not set — skipping members.");
    } else {
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = await ingestMembers({
        apiKey,
        supabaseUrl: supabaseUrl!,
        supabaseServiceKey: supabaseServiceKey!,
        fromDateTime: since,
        currentMember: true,
      });
      console.log("members:", JSON.stringify(result));
    }
  }

  if (tasks.includes("scores")) {
    const result = await ingestScores({
      supabaseUrl: supabaseUrl!,
      supabaseServiceKey: supabaseServiceKey!,
      congress,
    });
    console.log("scores:", JSON.stringify(result));
  }

  console.log("Sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
