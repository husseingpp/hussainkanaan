/**
 * Scheduled incremental sync endpoint (Vercel Cron).
 *
 * Vercel invokes this on the schedule in vercel.json and automatically attaches
 * `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set —
 * which is also how we authorise the call. Anyone may trigger a sync manually:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<deployment>/api/cron/sync?tasks=members,scores"
 *
 * Defaults to a cheap, incremental MEMBERS sync (only records changed in the
 * last ~2 days; upserts are idempotent, so the overlap is safe). Heavier jobs
 * (bills, votes) are intentionally left to a manual run — they cost far more of
 * the ~5,000 req/day Congress.gov budget and can exceed a serverless timeout.
 */

import { NextResponse } from "next/server";
import { ingestMembers } from "../../../../ingest/members.ts";
import { ingestScores } from "../../../../ingest/scores.ts";
import { currentCongress } from "../../../../lib/constants.ts";

// Ingestion uses Node APIs + the service-role key — never the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: no secret configured -> no access
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "missing Supabase env (URL / service-role key)" },
      { status: 500 },
    );
  }

  const tasks = (new URL(req.url).searchParams.get("tasks") ?? "members")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const congress = Number(process.env.CURRENT_CONGRESS) || currentCongress();
  const out: Record<string, unknown> = { congress, tasks };

  try {
    if (tasks.includes("members")) {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        out.members = { skipped: "CONGRESS_API_KEY not set" };
      } else {
        const since = new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000,
        ).toISOString();
        out.members = await ingestMembers({
          apiKey,
          supabaseUrl,
          supabaseServiceKey,
          fromDateTime: since,
          currentMember: true,
        });
      }
    }

    if (tasks.includes("scores")) {
      out.scores = await ingestScores({
        supabaseUrl,
        supabaseServiceKey,
        congress,
      });
    }

    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ...out },
      { status: 500 },
    );
  }
}
