# Ingestion modules

Server-side jobs that populate the database via the Supabase service-role key.
Added one per phase (see `../CLAUDE.md` build order):

- `_client.ts` — rate-limited, retrying, paging Congress.gov client (Phase 2)
- `members.ts` — `members` + `terms` (Phase 3)
- `bills.ts` — `bills` + `sponsorships` (Phase 5)
- `votes.ts` — House Clerk / Senate roll-call XML → `votes` (Phase 6)
- `scores.ts` — external ideology metric → `alignment_scores` (Phase 7)

All ingestion is idempotent (upserts on stable keys) so jobs can re-run safely.
