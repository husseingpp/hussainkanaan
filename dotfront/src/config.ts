// All gameplay constants live here (BLUEPRINT.md rule 4) so balancing is a
// one-file job. M0 only needs the loop, world, drift, and camera numbers;
// later milestones append their sections.

export const CONFIG = {
  /** Fixed simulation timestep (BLUEPRINT.md §4: 20 TPS). */
  TICK_MS: 50,
  /** Cap on sim ticks run per rendered frame so a stalled tab can't spiral. */
  MAX_TICKS_PER_FRAME: 5,
  /** Frame deltas above this are clamped (tab was hidden / debugger paused). */
  MAX_FRAME_DELTA_MS: 250,

  WORLD: {
    WIDTH: 2400,
    HEIGHT: 1600,
  },

  UNIT: {
    /** Boids separation radius — units closer than this push apart, px. */
    INTERACTION_RADIUS: 20,
    /** Visual duration of a gun-fire tracer flash, ms (M8). */
    TRACER_DURATION_MS: 200,
    /** Spacing between adjacent formation slots, world px (M8). */
    FORMATION_SPACING: 18,
  },

  /** Combat, morale & healing (BLUEPRINT.md §5.2). */
  COMBAT: {
    /** Attacking units take +30% incoming damage. */
    ATTACKER_DAMAGE_MULT: 1.3,
    /** Attacking units lose morale ~2× faster. */
    ATTACKER_MORALE_MULT: 2,
    MORALE_MAX: 100,
    /** Morale lost per second while in combat (defending baseline). */
    MORALE_DRAIN: 8,
    /** Morale regained per second out of combat. */
    MORALE_REGEN: 12,
    /** Below this morale, damage output halves. */
    MORALE_LOW: 30,
    LOW_MORALE_DAMAGE_MULT: 0.5,
    /** At morale 0 a unit routs: uncontrollable, flees to nearest friendly city. */
    ROUT_DURATION: 3,
    ROUT_RECOVER_MORALE: 35,
    /** Healing per second: in the field (no enemy within HEAL_SAFE_RADIUS). */
    HEAL_FIELD: 2,
    /** Healing per second inside a friendly city radius. */
    HEAL_CITY: 4,
    HEAL_SAFE_RADIUS: 150,
    /** White hit-flash duration, seconds (visual). */
    FLASH_DURATION: 0.12,
    /** Combat shake amplitude, world px (visual). */
    SHAKE_AMPLITUDE: 1.4,
  },

  MOVEMENT: {
    /** Cruising speed of drifting dots, px/s. */
    DRIFT_SPEED: 30,
    /** Ordered march speed (light units at full health on plains), px/s. */
    PATH_SPEED: 60,
    /** Neighbors closer than this push each other apart, px. */
    SEPARATION_RADIUS: 14,
    /** Separation acceleration at full overlap, px/s². */
    SEPARATION_ACCEL: 600,
    /** How quickly velocity relaxes toward desired, 1/s (higher = crisper). */
    SPEED_RELAX_RATE: 12,
    /** Distance to a waypoint at which we consider it "arrived", px. */
    ARRIVAL_RADIUS: 8,
    /** Begin decelerating toward the final waypoint within this distance. */
    DECEL_RADIUS: 48,
  },

  /** M1 input constants. */
  INPUT: {
    /** Min pointer-travel (world px) before a drag is treated as lasso/path. */
    DRAG_THRESHOLD: 5,
    /** Waypoints are placed every N world-px along the drawn path. */
    PATH_WAYPOINT_SPACING: 20,
  },

  /** Spatial hash cell ≈ 2× unit interaction radius (BLUEPRINT.md §4). */
  SPATIAL_CELL_SIZE: 28,

  CAMERA: {
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 2,
    /** Keyboard/edge pan speed at zoom 1, px/s. */
    PAN_SPEED: 600,
    /** Cursor within this many px of a window edge pans the camera. */
    EDGE_PAN_MARGIN: 24,
    /** Multiplicative zoom step per wheel notch. */
    ZOOM_STEP: 1.1,
  },

  M0: {
    DOT_COUNT: 50,
    DEFAULT_SEED: 1337,
  },

  /** Terrain grid (BLUEPRINT.md §5.4). Per-unit modifiers moved to unit-types.ts. */
  TERRAIN: {
    CELL_SIZE: 32,
    /** Water HP drain per second (from M3). */
    WATER_HP_DRAIN: 1,
  },

  /** Procedural map generation (BLUEPRINT.md §5.4). */
  MAP: {
    /** fbm sampling frequency per cell (lower = larger landmasses). */
    NOISE_FREQ: 0.05,
    NOISE_OCTAVES: 4,
    NOISE_PERSISTENCE: 0.5,
    /** Elevation thresholds (fBm clusters near 0.5, so keep these close to it):
     *  below WATER→water, above HILL→hills, above MOUNTAIN→mountain. */
    ELEV_WATER: 0.4,
    ELEV_HILL: 0.56,
    ELEV_MOUNTAIN: 0.66,
    /** Moisture above this on mid elevation → forest. */
    MOISTURE_FOREST: 0.52,
    CITY_RADIUS: 26,
    MIN_NEUTRAL_CITIES: 8,
    MAX_NEUTRAL_CITIES: 12,
    /** Minimum spacing between any two cities, world px. */
    CITY_SPACING: 240,
    /** Capitals are placed within this fraction of the left/right edges. */
    CAPITAL_BAND: 0.2,
    /** Max whole-map re-rolls before accepting the best effort. */
    MAX_REROLLS: 40,
    /** Starting army spawned near the player capital (M2 demo). */
    START_INFANTRY: 30,
    START_TANKS: 8,
    START_ARTILLERY: 4,
    START_DRONES: 6,
    /** Radius around the capital within which the start army spawns. */
    SPAWN_RADIUS: 140,
  },

  /** AI Strategist + Commander (BLUEPRINT.md §6). */
  AI: {
    /** Radius to check for player units threatening an enemy city. */
    DEFEND_RADIUS: 220,
    /** Radius to count local units for attack-odds calculation. */
    ATTACK_RADIUS: 350,
    /** Enemy:player force ratio required to commit to an attack. */
    FORCE_THRESHOLD: 1.3,
    /** Minimum enemy units nearby to initiate attack even below ratio. */
    ATTACK_MIN_FORCE: 12,
    /** Units sent in a squad to claim a neutral city. */
    EXPAND_SQUAD: 8,
    /** Money the AI always keeps in reserve before spending on production. */
    MONEY_RESERVE: 150,
    /** Max simultaneous active orders (defend/expand/attack groups). */
    MAX_ACTIVE_TARGETS: 4,
    /** Perpendicular offset as a fraction of path length for curved flanks. */
    ENCIRCLE_OFFSET: 0.35,
  },

  /** Win / match-timer conditions (BLUEPRINT.md §5.7). */
  WIN: {
    /** Fraction of all cities required (alongside capital capture) to win. */
    CITY_THRESHOLD: 0.8,
    /** Match duration in seconds; city count decides winner at timeout. */
    MATCH_DURATION: 900,
  },

  /** Territory & encirclement (BLUEPRINT.md §5.6). */
  TERRITORY: {
    /** Coarse grid cell size, px. Larger = faster flood fill. */
    CELL_SIZE: 64,
    /** A coarse cell is claimed if any unit/city is within this radius, px. */
    REACH: 80,
    /** Re-run territory computation every N sim ticks (~1s at 20 TPS). */
    STAGGER: 20,
  },

  /** Economy, production & capture (BLUEPRINT.md §5.3). */
  ECONOMY: {
    /** Money earned per owned city per second. */
    CITY_INCOME: 10,
    /** Supply weight capacity each owned city provides. */
    SUPPLY_PER_CITY: 5,
    /** HP/s drained from over-supply-cap field units. */
    STARVATION_DPS: 2,
    /** Seconds a unit must hold a city uncontested to capture it. */
    CAPTURE_TIME: 5,
    /** Starting money for each player. */
    START_MONEY: 600,
  },

  COLORS: {
    BACKGROUND: '#F2EFE9',
    PLAYER: '#2E6CF6',
    ENEMY: '#E5484D',
    NEUTRAL: '#9B9B9B',
    WORLD_BORDER: '#D8D2C6',
    DEBUG_HASH_GRID: 'rgba(155, 155, 155, 0.35)',
    DEBUG_HASH_FILL: 'rgba(46, 108, 246, 0.10)',
    DEBUG_TERRAIN_GRID: 'rgba(80, 80, 80, 0.18)',
    /** Terrain fills [plains, forest, hills, water, mountain] (§7). */
    TERRAIN: ['#E9E4D8', '#C8D8C0', '#DCD3BE', '#BFD7E8', '#B0AAA2'],
    /** Mountain ridge mark. */
    MOUNTAIN_RIDGE: 'rgba(120, 112, 104, 0.55)',
    CITY_FILL: '#FBF9F4',
  },
} as const;
