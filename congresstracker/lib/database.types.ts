/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
 *
 * Once a Supabase project exists, these can be regenerated with:
 *   supabase gen types typescript --linked > lib/database.types.ts
 * Until then this keeps the app type-safe against the migration.
 */

export type Chamber = "house" | "senate";
export type Party = "D" | "R" | "I" | "ID" | "L" | "Other";
export type Wing = "left" | "center" | "right";
export type VotePosition = "yea" | "nay" | "present" | "not_voting";
export type PromiseStatus =
  | "unverified"
  | "kept"
  | "broken"
  | "partial"
  | "stalled";

export interface Member {
  bioguide_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  party: Party | null;
  state: string | null;
  current_chamber: Chamber | null;
  image_url: string | null;
  congress_url: string | null;
  current_wing: Wing | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Term {
  id: string;
  bioguide_id: string;
  congress: number;
  chamber: Chamber;
  state: string | null;
  district: number | null;
  party: Party | null;
  start_year: number | null;
  end_year: number | null;
  created_at: string;
}

export interface Bill {
  id: string;
  congress: number;
  bill_type: string;
  number: number;
  title: string | null;
  short_title: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action: string | null;
  became_law: boolean;
  policy_area: string | null;
  congress_url: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sponsorship {
  id: string;
  bioguide_id: string;
  bill_id: string;
  is_sponsor: boolean;
  sponsored_date: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  bioguide_id: string;
  congress: number;
  chamber: Chamber;
  session: number | null;
  roll_call: number;
  vote_date: string | null;
  question: string | null;
  description: string | null;
  bill_id: string | null;
  position: VotePosition;
  /** Mandatory — enforced NOT NULL + non-empty in the schema. */
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface PromiseRow {
  id: string;
  bioguide_id: string;
  text: string;
  topic: string | null;
  made_date: string | null;
  made_context: string | null;
  /** Mandatory — enforced NOT NULL + non-empty in the schema. */
  source_url: string;
  status: PromiseStatus;
  status_rationale: string | null;
  status_source_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlignmentScore {
  id: string;
  bioguide_id: string;
  congress: number;
  metric: string;
  dimension1: number | null;
  dimension2: number | null;
  wing: Wing;
  source_url: string;
  methodology_url: string;
  computed_at: string;
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

interface Table<T> {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
}

export interface Database {
  public: {
    Tables: {
      members: Table<Member>;
      terms: Table<Term>;
      bills: Table<Bill>;
      sponsorships: Table<Sponsorship>;
      votes: Table<Vote>;
      promises: Table<PromiseRow>;
      alignment_scores: Table<AlignmentScore>;
    };
    Enums: {
      chamber: Chamber;
      party: Party;
      wing: Wing;
      vote_position: VotePosition;
      promise_status: PromiseStatus;
    };
  };
}
