import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { City, GameState } from '../core/state';
import { checkWin } from './win';
import { makeGrid } from './terrain';

const W = CONFIG.WIN;

function makeCity(id: number, owner: City['owner'], isCapital: boolean): City {
  return {
    id, owner, pos: { x: 100 * id, y: 100 }, radius: 26, isCapital,
    captureProgress: 0, captureBy: null, productionQueue: [],
  };
}

function makeState(cities: City[], matchTime = 0): GameState {
  const cols = Math.ceil(CONFIG.WORLD.WIDTH / CONFIG.TERRAIN.CELL_SIZE);
  const rows = Math.ceil(CONFIG.WORLD.HEIGHT / CONFIG.TERRAIN.CELL_SIZE);
  return {
    tick: 0,
    rng: () => 0.5,
    units: [],
    cities,
    terrain: makeGrid(cols, rows, CONFIG.TERRAIN.CELL_SIZE),
    world: { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT },
    money: { player: 0, enemy: 0 },
    territory: null,
    matchPhase: 'playing',
    matchTime,
  };
}

describe('checkWin', () => {
  it('returns null during normal mid-game', () => {
    // Both players have their capitals and < 80% of cities.
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'enemy', true),
      makeCity(2, 'neutral', false),
      makeCity(3, 'neutral', false),
      makeCity(4, 'neutral', false),
    ];
    expect(checkWin(makeState(cities))).toBeNull();
  });

  it('player wins when enemy capital captured AND player owns ≥80%', () => {
    // 5 cities: player owns 4 (including enemy capital), neutral 1.
    // threshold = ceil(5 × 0.8) = 4
    const cities = [
      makeCity(0, 'player', true),   // player capital (still theirs)
      makeCity(1, 'player', true),   // enemy capital — now owned by player!
      makeCity(2, 'player', false),
      makeCity(3, 'player', false),
      makeCity(4, 'neutral', false),
    ];
    expect(checkWin(makeState(cities))).toBe('player');
  });

  it('enemy wins when player capital captured AND enemy owns ≥80%', () => {
    const cities = [
      makeCity(0, 'enemy', true),    // player capital — now owned by enemy!
      makeCity(1, 'enemy', true),    // enemy capital
      makeCity(2, 'enemy', false),
      makeCity(3, 'enemy', false),
      makeCity(4, 'neutral', false),
    ];
    expect(checkWin(makeState(cities))).toBe('enemy');
  });

  it('returns null when enemy capital is captured but winner owns <80%', () => {
    // Enemy capital captured, but player only owns 3/5 = 60%.
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'player', true),   // enemy capital — captured
      makeCity(2, 'player', false),
      makeCity(3, 'enemy', false),   // enemy still holds cities
      makeCity(4, 'enemy', false),
    ];
    // 3/5 = 60% < 80% → no win yet
    expect(checkWin(makeState(cities))).toBeNull();
  });

  it('timer win: player has more cities after MATCH_DURATION', () => {
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'player', false),
      makeCity(2, 'enemy', true),
    ];
    expect(checkWin(makeState(cities, W.MATCH_DURATION + 1))).toBe('player');
  });

  it('timer win: enemy has more cities', () => {
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'enemy', true),
      makeCity(2, 'enemy', false),
    ];
    expect(checkWin(makeState(cities, W.MATCH_DURATION + 1))).toBe('enemy');
  });

  it('draw: equal cities at timer', () => {
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'enemy', true),
    ];
    expect(checkWin(makeState(cities, W.MATCH_DURATION))).toBe('draw');
  });

  it('returns null if timer has not yet expired', () => {
    const cities = [
      makeCity(0, 'player', true),
      makeCity(1, 'player', false),
      makeCity(2, 'enemy', true),
    ];
    // Player leads on cities but timer hasn't expired and enemy capital still held.
    expect(checkWin(makeState(cities, W.MATCH_DURATION - 1))).toBeNull();
  });
});
