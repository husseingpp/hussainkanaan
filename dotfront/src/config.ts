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
    /** Auto-attack engagement range (§5.1) — also the M0 separation radius. */
    INTERACTION_RADIUS: 14,
  },

  MOVEMENT: {
    /** Cruising speed of M0 drifting dots, px/s. */
    DRIFT_SPEED: 30,
    /** Neighbors closer than this push each other apart, px. */
    SEPARATION_RADIUS: 14,
    /** Separation acceleration at full overlap, px/s². */
    SEPARATION_ACCEL: 600,
    /** How quickly speed relaxes back to DRIFT_SPEED after separation, 1/s. */
    SPEED_RELAX_RATE: 2,
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

  COLORS: {
    BACKGROUND: '#F2EFE9',
    PLAYER: '#2E6CF6',
    ENEMY: '#E5484D',
    NEUTRAL: '#9B9B9B',
    WORLD_BORDER: '#D8D2C6',
    DEBUG_HASH_GRID: 'rgba(155, 155, 155, 0.35)',
    DEBUG_HASH_FILL: 'rgba(46, 108, 246, 0.10)',
  },
} as const;
