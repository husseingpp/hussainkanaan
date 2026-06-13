// Victory condition checks (BLUEPRINT.md §5.7). Pure.
//
// Win:  capture the enemy capital AND own ≥80% of all cities.
//       (Capturing the capital flips its owner; the loser fights on.)
// Draw: after MATCH_DURATION seconds, most cities wins; ties are draws.

import { CONFIG } from '../config';
import type { GameState } from '../core/state';

export function checkWin(state: GameState): 'player' | 'enemy' | 'draw' | null {
  const { cities, matchTime } = state;
  const total = cities.length;
  const threshold = Math.ceil(total * CONFIG.WIN.CITY_THRESHOLD);

  // Timer win: most cities after MATCH_DURATION.
  if (matchTime >= CONFIG.WIN.MATCH_DURATION) {
    const pc = cities.filter((c) => c.owner === 'player').length;
    const ec = cities.filter((c) => c.owner === 'enemy').length;
    if (pc > ec) return 'player';
    if (ec > pc) return 'enemy';
    return 'draw';
  }

  // Capital + threshold win: loser's capital was captured + winner owns ≥80%.
  for (const winner of ['player', 'enemy'] as const) {
    const loser: typeof winner = winner === 'player' ? 'enemy' : 'player';
    // Does the loser still own their own capital?
    if (cities.some((c) => c.isCapital && c.owner === loser)) continue;
    // Their capital is gone — does the winner own enough?
    const owned = cities.filter((c) => c.owner === winner).length;
    if (owned >= threshold) return winner;
  }

  return null;
}
