// AI Strategist (BLUEPRINT.md §6): evaluates game state ~1/sec and builds a
// priority-sorted list of tactical targets (defend / expand / attack).
// Pure: no Math.random, no DOM. All randomness via state.rng in commander.

import { CONFIG } from '../config';
import type { GameState, Owner, Vec2 } from '../core/state';
import { runCommander } from './commander';

const AI = CONFIG.AI;
const EC = CONFIG.ECONOMY;

export interface AiTarget {
  pos: Vec2;
  intent: 'defend' | 'expand' | 'attack';
  priority: number;
  unitBudget: number;
  /** Use a curved/flanking path (commander adds a perpendicular midpoint). */
  curved: boolean;
}

/** Main AI entry point. Called from simulate.ts every STAGGER ticks. */
export function stepAI(state: GameState): void {
  if (state.matchPhase !== 'playing') return;
  runEconomy(state);
  const targets = buildTargets(state);
  runCommander(targets, state);
}

// ── Economy ──────────────────────────────────────────────────────────────────

function runEconomy(state: GameState): void {
  const lights = state.units.filter((u) => u.owner === 'enemy' && u.kind === 'light' && u.hp > 0).length;
  const heavies = state.units.filter((u) => u.owner === 'enemy' && u.kind === 'heavy' && u.hp > 0).length;
  // Aim for ~3:1 light:heavy ratio.
  const wantHeavy = heavies === 0 || lights / heavies >= 3;

  for (const city of state.cities) {
    if (city.owner !== 'enemy' || city.productionQueue.length > 0) continue;

    if (wantHeavy && state.money.enemy >= EC.HEAVY_COST + AI.MONEY_RESERVE) {
      state.money.enemy -= EC.HEAVY_COST;
      city.productionQueue.push({ kind: 'heavy', progress: 0, rallyPoint: null });
    } else if (state.money.enemy >= EC.LIGHT_COST + AI.MONEY_RESERVE) {
      state.money.enemy -= EC.LIGHT_COST;
      city.productionQueue.push({ kind: 'light', progress: 0, rallyPoint: null });
    }
  }
}

// ── Target selection ──────────────────────────────────────────────────────────

function buildTargets(state: GameState): AiTarget[] {
  const targets: AiTarget[] = [];

  // 1. DEFEND: enemy cities with player units nearby (highest urgency).
  for (const city of state.cities) {
    if (city.owner !== 'enemy') continue;
    const threat = countUnits(state, city.pos, AI.DEFEND_RADIUS, 'player');
    if (threat > 0) {
      targets.push({
        pos: city.pos,
        intent: 'defend',
        priority: threat * 10 + 5,
        unitBudget: Math.max(threat * 2, 10),
        curved: false,
      });
    }
  }

  // 2. EXPAND: neutral cities, preferring those closest to the enemy capital.
  const enemyCapital = state.cities.find((c) => c.isCapital && c.owner === 'enemy');
  for (const city of state.cities) {
    if (city.owner !== 'neutral') continue;
    const d = enemyCapital
      ? Math.hypot(city.pos.x - enemyCapital.pos.x, city.pos.y - enemyCapital.pos.y)
      : 9999;
    targets.push({
      pos: city.pos,
      intent: 'expand',
      priority: 5000 / (d + 1),
      unitBudget: AI.EXPAND_SQUAD,
      curved: false,
    });
  }

  // 3. ATTACK: player cities where enemy has local force advantage.
  for (const city of state.cities) {
    if (city.owner !== 'player') continue;
    const friendly = countUnits(state, city.pos, AI.ATTACK_RADIUS, 'enemy');
    if (friendly === 0) continue;
    const hostile = countUnits(state, city.pos, AI.ATTACK_RADIUS, 'player');
    const ratio = hostile > 0 ? friendly / hostile : friendly;
    if (ratio >= AI.FORCE_THRESHOLD || friendly >= AI.ATTACK_MIN_FORCE) {
      targets.push({
        pos: city.pos,
        intent: 'attack',
        priority: ratio * 3,
        unitBudget: Math.max(friendly, AI.ATTACK_MIN_FORCE),
        curved: city.isCapital, // flank the player capital
      });
    }
  }

  // 4. FALLBACK: march all idle units toward the nearest player city.
  if (targets.length === 0) {
    const tgt =
      state.cities.find((c) => c.owner === 'player' && c.isCapital) ??
      state.cities.find((c) => c.owner === 'player');
    if (tgt) {
      targets.push({
        pos: tgt.pos,
        intent: 'attack',
        priority: 0.5,
        unitBudget: 40,
        curved: false,
      });
    }
  }

  return targets.sort((a, b) => b.priority - a.priority);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countUnits(state: GameState, pos: Vec2, radius: number, owner: Owner): number {
  const r2 = radius * radius;
  let n = 0;
  for (const u of state.units) {
    if (u.owner !== owner || u.hp <= 0) continue;
    const dx = u.pos.x - pos.x;
    const dy = u.pos.y - pos.y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}
