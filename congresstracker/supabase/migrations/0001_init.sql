-- CongressTracker — initial schema (Phase 1)
--
-- Design rules enforced here (see CLAUDE.md "Hard rules"):
--   * Every `promises` row and every `votes` row MUST carry a non-empty source_url.
--     This is enforced by NOT NULL + CHECK so a sourceless factual claim cannot
--     even be inserted ("no source, no display" at the storage layer).
--   * A promise marked `broken` requires both a source_url AND a reviewer.
--     Default promise status is `unverified` — never guess.
--   * Wing classification is derived from an external, sourced ideology metric
--     (e.g. DW-NOMINATE) stored in `alignment_scores`, not invented here.
--   * Public access is READ-ONLY via the anon key (RLS). All writes go through
--     the service-role key (ingestion) or an authenticated reviewer (promises).
--
-- This file is idempotent-friendly for development: it uses IF NOT EXISTS where
-- Postgres allows it. Run as a single migration on a fresh database.

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
do $$ begin
  create type chamber as enum ('house', 'senate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type party as enum ('D', 'R', 'I', 'ID', 'L', 'Other');
exception when duplicate_object then null; end $$;

-- Descriptive ideological wing. Derived from a sourced metric, never pejorative.
do $$ begin
  create type wing as enum ('left', 'center', 'right');
exception when duplicate_object then null; end $$;

-- A member's recorded position on a roll-call vote.
do $$ begin
  create type vote_position as enum ('yea', 'nay', 'present', 'not_voting');
exception when duplicate_object then null; end $$;

-- Promise lifecycle. Defaults to `unverified`; `broken` is the defamation-
-- sensitive state and is constrained below to require a source AND reviewer.
do $$ begin
  create type promise_status as enum ('unverified', 'kept', 'broken', 'partial', 'stalled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- members  (one row per member of Congress, keyed by Bioguide ID)
-- ---------------------------------------------------------------------------
create table if not exists members (
  bioguide_id   text primary key,
  first_name    text not null,
  last_name     text not null,
  full_name     text not null,
  party         party,
  state         text,                         -- two-letter postal code
  current_chamber chamber,
  image_url     text,
  congress_url  text,                          -- canonical congress.gov member URL
  -- Cached classification for display. The authoritative score lives in
  -- alignment_scores; this is a denormalised convenience, always re-derivable.
  current_wing  wing,
  -- Sync bookkeeping for incremental, rate-limit-friendly ingestion.
  source_updated_at timestamptz,               -- congress.gov `updateDate`
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_members_updated_at on members;
create trigger trg_members_updated_at
  before update on members
  for each row execute function set_updated_at();

create index if not exists members_last_name_idx on members (last_name);
create index if not exists members_state_idx on members (state);
create index if not exists members_wing_idx on members (current_wing);

-- ---------------------------------------------------------------------------
-- terms  (each chamber-term a member has served)
-- ---------------------------------------------------------------------------
create table if not exists terms (
  id            uuid primary key default gen_random_uuid(),
  bioguide_id   text not null references members (bioguide_id) on delete cascade,
  congress      int not null,                  -- e.g. 118
  chamber       chamber not null,
  state         text,
  district      int,                            -- null for senators
  party         party,
  start_year    int,
  end_year      int,
  created_at    timestamptz not null default now()
);

-- One row per member per congress/chamber/district. district is nullable
-- (senators), so coalesce it in a unique INDEX — a table UNIQUE constraint
-- cannot contain an expression.
create unique index if not exists terms_unique_idx
  on terms (bioguide_id, congress, chamber, coalesce(district, -1));

create index if not exists terms_bioguide_idx on terms (bioguide_id);
create index if not exists terms_congress_idx on terms (congress);

-- ---------------------------------------------------------------------------
-- bills  (id = "{congress}-{type}-{number}", e.g. "118-hr-1")
-- ---------------------------------------------------------------------------
create table if not exists bills (
  id            text primary key,              -- "{congress}-{type}-{number}"
  congress      int not null,
  bill_type     text not null,                 -- hr, s, hjres, sjres, hconres, ...
  number        int not null,
  title         text,
  short_title   text,
  introduced_date date,
  latest_action_date date,
  latest_action  text,
  became_law    boolean not null default false,
  policy_area   text,
  congress_url  text,                           -- canonical congress.gov bill URL
  source_updated_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (congress, bill_type, number)
);

drop trigger if exists trg_bills_updated_at on bills;
create trigger trg_bills_updated_at
  before update on bills
  for each row execute function set_updated_at();

create index if not exists bills_congress_idx on bills (congress);
create index if not exists bills_became_law_idx on bills (became_law);

-- ---------------------------------------------------------------------------
-- sponsorships  (member <-> bill, sponsor or cosponsor)
-- ---------------------------------------------------------------------------
create table if not exists sponsorships (
  id            uuid primary key default gen_random_uuid(),
  bioguide_id   text not null references members (bioguide_id) on delete cascade,
  bill_id       text not null references bills (id) on delete cascade,
  is_sponsor    boolean not null default false, -- true = primary sponsor, false = cosponsor
  sponsored_date date,
  created_at    timestamptz not null default now(),
  unique (bioguide_id, bill_id)
);

create index if not exists sponsorships_bill_idx on sponsorships (bill_id);
create index if not exists sponsorships_member_idx on sponsorships (bioguide_id);

-- ---------------------------------------------------------------------------
-- votes  (a member's recorded position on a single roll-call vote)
--
-- HARD RULE: every vote row carries a source_url (the House Clerk / Senate
-- roll-call XML it was parsed from). Enforced NOT NULL + non-empty CHECK.
-- ---------------------------------------------------------------------------
create table if not exists votes (
  id            uuid primary key default gen_random_uuid(),
  bioguide_id   text not null references members (bioguide_id) on delete cascade,
  congress      int not null,
  chamber       chamber not null,
  session       int,                            -- 1 or 2
  roll_call     int not null,                   -- roll number within the chamber/session
  vote_date     date,
  question      text,                           -- e.g. "On Passage"
  description   text,
  bill_id       text references bills (id) on delete set null,
  position      vote_position not null,
  -- Provenance is mandatory. No source_url -> the row cannot exist.
  source_url    text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint votes_source_url_not_blank check (length(trim(source_url)) > 0),
  unique (bioguide_id, congress, chamber, session, roll_call)
);

drop trigger if exists trg_votes_updated_at on votes;
create trigger trg_votes_updated_at
  before update on votes
  for each row execute function set_updated_at();

create index if not exists votes_member_idx on votes (bioguide_id);
create index if not exists votes_bill_idx on votes (bill_id);
create index if not exists votes_rollcall_idx on votes (congress, chamber, session, roll_call);

-- ---------------------------------------------------------------------------
-- promises  (sourced, human-reviewed campaign promises and their status)
--
-- HARD RULES:
--   * source_url is mandatory and non-empty (no source, no display).
--   * status defaults to `unverified`; an LLM/ingestion job must never assert
--     a status. Status changes are a reviewer action.
--   * A `broken` (or `kept`/`partial`) status requires a reviewer AND a source.
--     `unverified` may exist before review.
-- ---------------------------------------------------------------------------
create table if not exists promises (
  id            uuid primary key default gen_random_uuid(),
  bioguide_id   text not null references members (bioguide_id) on delete cascade,
  -- The promise as stated, with where/when it was made.
  text          text not null,
  topic         text,                           -- e.g. "healthcare", "taxes"
  made_date     date,
  made_context  text,                           -- e.g. "2022 campaign website"
  -- Provenance of the PROMISE itself is mandatory.
  source_url    text not null,
  -- Status + its justification.
  status        promise_status not null default 'unverified',
  status_rationale text,
  -- Provenance of the STATUS judgement (the evidence the reviewer relied on).
  status_source_url text,
  -- Review trail. A non-unverified status must be attributed to a reviewer.
  reviewed_by   uuid references auth.users (id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint promises_source_url_not_blank
    check (length(trim(source_url)) > 0),

  -- Any non-unverified status must be backed by a reviewer and a status source.
  constraint promises_resolved_requires_review check (
    status = 'unverified'
    or (
      reviewed_by is not null
      and status_source_url is not null
      and length(trim(status_source_url)) > 0
    )
  )
);

drop trigger if exists trg_promises_updated_at on promises;
create trigger trg_promises_updated_at
  before update on promises
  for each row execute function set_updated_at();

create index if not exists promises_member_idx on promises (bioguide_id);
create index if not exists promises_status_idx on promises (status);

-- ---------------------------------------------------------------------------
-- alignment_scores  (computed classification from an external sourced metric)
--
-- The ideology number (e.g. DW-NOMINATE dimension 1) is imported from a cited
-- dataset. `wing` is the bucketed presentation of that number. `methodology_url`
-- points at /methodology so every classification is explainable + linkable.
-- ---------------------------------------------------------------------------
create table if not exists alignment_scores (
  id            uuid primary key default gen_random_uuid(),
  bioguide_id   text not null references members (bioguide_id) on delete cascade,
  congress      int not null,
  metric        text not null default 'dw-nominate',
  dimension1    numeric,                         -- the raw ideology score
  dimension2    numeric,
  wing          wing not null,
  -- Provenance: where the metric came from, and how the bucket is defined.
  source_url    text not null,
  methodology_url text not null default '/methodology',
  computed_at   timestamptz not null default now(),
  constraint alignment_source_url_not_blank check (length(trim(source_url)) > 0),
  unique (bioguide_id, congress, metric)
);

create index if not exists alignment_member_idx on alignment_scores (bioguide_id);
create index if not exists alignment_wing_idx on alignment_scores (wing);

-- ===========================================================================
-- Row Level Security
--
-- Model:
--   * anon / authenticated  -> SELECT only on every table (public read site).
--   * promises              -> additionally, an authenticated reviewer may
--                              INSERT/UPDATE (the admin review tool).
--   * service_role          -> bypasses RLS entirely (used by ingestion jobs),
--                              so no write policies are defined for anon.
-- ===========================================================================

alter table members          enable row level security;
alter table terms            enable row level security;
alter table bills            enable row level security;
alter table sponsorships     enable row level security;
alter table votes            enable row level security;
alter table promises         enable row level security;
alter table alignment_scores enable row level security;

-- Public read-only access on all tables.
do $$
declare t text;
begin
  foreach t in array array[
    'members','terms','bills','sponsorships','votes','promises','alignment_scores'
  ]
  loop
    execute format(
      'drop policy if exists %I on %I;', 'public_read_' || t, t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true);',
      'public_read_' || t, t);
  end loop;
end $$;

-- Authenticated reviewers may create and edit promises (the /admin tool).
-- (Tighten later to a "reviewer" role/claim; for now any signed-in user.)
drop policy if exists reviewer_insert_promises on promises;
create policy reviewer_insert_promises on promises
  for insert to authenticated
  with check (true);

drop policy if exists reviewer_update_promises on promises;
create policy reviewer_update_promises on promises
  for update to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Table-level GRANTs (the layer beneath RLS)
--
-- RLS only filters rows for roles that already hold the privilege. We grant
-- explicitly rather than relying on Supabase's default privileges, so the
-- intent — anon is read-only, reviewers may write promises — is self-contained
-- and portable. anon is deliberately NOT granted any write, so both the GRANT
-- and RLS layers enforce read-only for the public.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on
  members, terms, bills, sponsorships, votes, promises, alignment_scores
  to anon, authenticated;

-- Reviewers (signed-in users) may create/edit promises via the admin tool.
grant insert, update on promises to authenticated;

-- Ingestion jobs run as service_role (which also bypasses RLS in Supabase).
grant all on
  members, terms, bills, sponsorships, votes, promises, alignment_scores
  to service_role;

commit;
