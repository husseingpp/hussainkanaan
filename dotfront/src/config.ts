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
    /** Light unit visual radius (§5.1). */
    LIGHT_RADIUS: 4,
    /** Heavy unit visual radius (§5.1) — drawn with an inner ring. */
    HEAVY_RADIUS: 6,
    /** Base march speed on plains, px/s (§5.1). */
    LIGHT_SPEED: 60,
    HEAVY_SPEED: 35,
    /** Auto-attack engagement range (§5.1) — also the separation radius. */
    INTERACTION_RADIUS: 14,
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

  /** Terrain grid + per-type modifiers (BLUEPRINT.md §5.4, MVP set). Speed and
   *  damage multipliers are indexed by terrain code (see sim/terrain.ts). */
  TERRAIN: {
    CELL_SIZE: 32,
    /** Speed multiplier [plains, forest, hills, water, mountain] for light units. */
    SPEED_LIGHT: [1, 1, 1, 0.5, 0],
    /** Speed multiplier for heavy units (forest/hills −50%). */
    SPEED_HEAVY: [1, 0.5, 0.5, 0.5, 0],
    /** Damage multiplier for light units (used from M3). */
    DAMAGE_LIGHT: [1, 1, 1, 0.6, 1],
    /** Damage multiplier for heavy units (forest/hills −60%). */
    DAMAGE_HEAVY: [1, 0.4, 0.4, 0.6, 1],
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
    START_LIGHT: 36,
    START_HEAVY: 12,
    /** Radius around the capital within which the start army spawns. */
    SPAWN_RADIUS: 140,
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
