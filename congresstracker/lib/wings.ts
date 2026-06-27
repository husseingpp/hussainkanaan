/**
 * Phase 9 — pure helpers for the three-wing browse + compare views.
 *
 * Kept free of any I/O so they can be unit-tested deterministically (the rest
 * of the app's "test hard" convention). Nothing here makes a factual claim;
 * these only group and tally already-sourced rows.
 */

import type {
  Member,
  Wing,
  VotePosition,
  PromiseStatus,
} from "./database.types.ts";

export const WINGS: Wing[] = ["left", "center", "right"];

export interface WingGroups<T = Member> {
  left: T[];
  center: T[];
  right: T[];
}

/** Split members into left/center/right by their cached current_wing. */
export function groupByWing<T extends { current_wing: Wing | null }>(
  members: T[],
): WingGroups<T> {
  const groups: WingGroups<T> = { left: [], center: [], right: [] };
  for (const m of members) {
    if (m.current_wing) groups[m.current_wing].push(m);
  }
  return groups;
}

/** Count vote positions in a member's recorded votes. */
export function tallyVotes(
  votes: Array<{ position: VotePosition }>,
): Record<VotePosition, number> {
  const out: Record<VotePosition, number> = {
    yea: 0,
    nay: 0,
    present: 0,
    not_voting: 0,
  };
  for (const v of votes) out[v.position] += 1;
  return out;
}

/** Count promise statuses in a member's promises. */
export function tallyPromises(
  promises: Array<{ status: PromiseStatus }>,
): Record<PromiseStatus, number> {
  const out: Record<PromiseStatus, number> = {
    unverified: 0,
    kept: 0,
    broken: 0,
    partial: 0,
    stalled: 0,
  };
  for (const p of promises) out[p.status] += 1;
  return out;
}

/** Whole-number percentage of part / total (0 when total is 0). */
export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
