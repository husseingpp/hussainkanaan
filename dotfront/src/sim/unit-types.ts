// Data-driven unit type definitions — replacing the old light/heavy binary split.
// All per-type tuning lives here so balancing is a single-file job (BLUEPRINT §4).

export type UnitKind = 'infantry' | 'tank' | 'artillery' | 'drone';

export interface RangeBand {
  threshold: number;   // max distance for this band (px)
  damageMul: number;   // multiplier applied to dps at this distance
}

export interface UnitTypeDef {
  displayName: string;
  radius: number;
  maxHp: number;
  speed: number;          // px per second on plains
  dps: number;            // base damage per second at point-blank / optimal range
  /** Three range bands (short, medium, long) sorted by threshold asc. */
  rangeBands: [RangeBand, RangeBand, RangeBand];
  splashRadius: number;   // >0 = artillery area damage in px; 0 = no splash
  supplyWeight: number;   // supply consumed per field unit
  moneyUpkeep: number;    // money drained per second in the field
  cost: number;
  spawnTime: number;      // seconds to produce
  /** Speed multipliers indexed by TerrainType [plains, forest, hills, water, mountain]. */
  terrainSpeed: [number, number, number, number, number];
  /** Damage multipliers indexed by TerrainType. */
  terrainDamage: [number, number, number, number, number];
  flying: boolean;        // drones ignore terrain speed penalties (except mountains)
}

export const UNIT_TYPES: Record<UnitKind, UnitTypeDef> = {
  infantry: {
    displayName: 'Infantry',
    radius: 5,
    maxHp: 80,
    speed: 55,
    dps: 12,
    rangeBands: [
      { threshold: 60,  damageMul: 1.0 },
      { threshold: 120, damageMul: 0.6 },
      { threshold: 200, damageMul: 0.25 },
    ],
    splashRadius: 0,
    supplyWeight: 1,
    moneyUpkeep: 1,
    cost: 200,
    spawnTime: 2,
    terrainSpeed:  [1.0, 0.75, 0.80, 0.45, 0.0],
    terrainDamage: [1.0, 0.80, 0.85, 0.70, 0.0],
    flying: false,
  },

  tank: {
    displayName: 'Tank',
    radius: 8,
    maxHp: 220,
    speed: 50,
    dps: 30,
    rangeBands: [
      { threshold: 80,  damageMul: 1.0 },
      { threshold: 180, damageMul: 0.75 },
      { threshold: 300, damageMul: 0.40 },
    ],
    splashRadius: 0,
    supplyWeight: 2,
    moneyUpkeep: 2,
    cost: 400,
    spawnTime: 3,
    terrainSpeed:  [1.0, 0.50, 0.60, 0.30, 0.0],
    terrainDamage: [1.0, 0.60, 0.70, 0.60, 0.0],
    flying: false,
  },

  artillery: {
    displayName: 'Artillery',
    radius: 7,
    maxHp: 100,
    speed: 35,
    dps: 50,
    rangeBands: [
      { threshold: 200, damageMul: 0.40 },  // too close — penalty
      { threshold: 400, damageMul: 1.00 },  // optimal range
      { threshold: 600, damageMul: 0.60 },  // long range
    ],
    splashRadius: 40,
    supplyWeight: 2,
    moneyUpkeep: 2,
    cost: 500,
    spawnTime: 4,
    terrainSpeed:  [1.0, 0.60, 0.65, 0.25, 0.0],
    terrainDamage: [1.0, 0.90, 0.90, 0.80, 0.0],
    flying: false,
  },

  drone: {
    displayName: 'Drone',
    radius: 4,
    maxHp: 50,
    speed: 90,
    dps: 15,
    rangeBands: [
      { threshold: 80,  damageMul: 1.00 },
      { threshold: 160, damageMul: 0.70 },
      { threshold: 250, damageMul: 0.35 },
    ],
    splashRadius: 0,
    supplyWeight: 1,
    moneyUpkeep: 1,
    cost: 300,
    spawnTime: 2,
    terrainSpeed:  [1.0, 1.0, 1.0, 1.0, 0.0],  // flying: ignore terrain except mountains
    terrainDamage: [1.0, 1.0, 1.0, 1.0, 0.0],
    flying: true,
  },
};

/** Damage multiplier for a unit firing at `dist` px based on its range bands.
 *  Returns 0 if the target is beyond max range. */
export function rangeBandMul(def: UnitTypeDef, dist: number): number {
  for (const band of def.rangeBands) {
    if (dist <= band.threshold) return band.damageMul;
  }
  return 0;
}

/** Maximum engagement range for this unit type. */
export function maxRange(def: UnitTypeDef): number {
  return def.rangeBands[2].threshold;
}
