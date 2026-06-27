-- CongressTracker — migration 0002
--
-- Adds `lis_id` to members.
--
-- Why: Senate roll-call XML identifies voters by their LIS member id
-- (e.g. "S354"), NOT by Bioguide id. Our members table is keyed by Bioguide,
-- so to attach Senate votes to the right person we need a deterministic
-- LIS -> Bioguide crosswalk. We store the LIS id on the member and resolve
-- Senate votes through it. (House Clerk XML already carries Bioguide ids, so
-- House votes need no crosswalk.)
--
-- We never guess member identity by name — defamation is the top risk — so a
-- Senate vote with no LIS match is skipped, not attached to a best-guess member.

begin;

alter table members add column if not exists lis_id text;

-- LIS ids are unique per member when present; allow many NULLs.
create unique index if not exists members_lis_id_idx
  on members (lis_id)
  where lis_id is not null;

commit;
