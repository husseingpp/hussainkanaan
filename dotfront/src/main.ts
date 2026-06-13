// M1 entry point: wires lasso selection, path orders, and camera through the
// fixed-timestep loop. Seed from `?seed=` for deterministic replay.

import { CONFIG } from './config';
import { GameLoop } from './core/loop';
import { hashSeed } from './core/rng';
import { SpatialHash } from './core/spatial-hash';
import { createInitialState, type Unit } from './core/state';
import { LassoCapture, pointInPolygon } from './input/lasso';
import { PathCapture, resamplePath } from './input/orders';
import { Camera } from './input/camera-input';
import { Renderer, type RenderOverlays } from './render/renderer';
import { createTerrainCanvas } from './render/terrain-layer';
import { assignPath, stepMovement, stopUnit } from './sim/movement';

// ── Seed ─────────────────────────────────────────────────────────────────────
function resolveSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || raw === '') return CONFIG.M0.DEFAULT_SEED;
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : hashSeed(raw);
}

const seed = resolveSeed();
const state = createInitialState(seed);
const hash = new SpatialHash<Unit>();

// ── Camera & Renderer ────────────────────────────────────────────────────────
const canvas = document.getElementById('game') as HTMLCanvasElement;
const camera = new Camera(state.world.width, state.world.height);
camera.attach(canvas);
const renderer = new Renderer(canvas, camera);
renderer.setTerrain(createTerrainCanvas(state.terrain));
window.addEventListener('resize', () => renderer.resize());

// Center the camera on the player capital so the army is on screen at start.
const playerCapital = state.cities.find((c) => c.owner === 'player' && c.isCapital);
if (playerCapital) {
  camera.x = playerCapital.pos.x;
  camera.y = playerCapital.pos.y;
}

// ── Input state ──────────────────────────────────────────────────────────────
const lasso = new LassoCapture();
const pathCapture = new PathCapture();

// Overlays passed to renderer each frame (updated by input handlers).
const overlays: RenderOverlays = {
  lassoPolygon: [],
  pathPreview: [],
  groupPath: [],
};

let dragStartScreen = { x: 0, y: 0 };
let dragging = false; // true once we've passed the drag threshold
type DragMode = 'lasso' | 'path' | 'none';
let dragMode: DragMode = 'none';

function selectedUnits(): Unit[] {
  return state.units.filter((u) => u.selected);
}

function hasSelection(): boolean {
  return state.units.some((u) => u.selected);
}

function deselectAll(): void {
  for (const u of state.units) u.selected = false;
  overlays.groupPath = [];
}

// ── Pointer events ────────────────────────────────────────────────────────────
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  dragStartScreen = { x: e.clientX, y: e.clientY };
  dragging = false;
  dragMode = 'none';
});

canvas.addEventListener('pointermove', (e) => {
  if ((e.buttons & 1) === 0) return;

  const { x: wx, y: wy } = camera.screenToWorld(e.clientX, e.clientY);
  const travel = Math.hypot(
    e.clientX - dragStartScreen.x,
    e.clientY - dragStartScreen.y,
  );

  if (!dragging && travel >= CONFIG.INPUT.DRAG_THRESHOLD) {
    dragging = true;
    // Decide mode: path if units selected, lasso otherwise.
    if (hasSelection()) {
      dragMode = 'path';
      const { x: sx, y: sy } = camera.screenToWorld(
        dragStartScreen.x,
        dragStartScreen.y,
      );
      pathCapture.begin(sx, sy);
    } else {
      dragMode = 'lasso';
      const { x: sx, y: sy } = camera.screenToWorld(
        dragStartScreen.x,
        dragStartScreen.y,
      );
      lasso.begin(sx, sy);
    }
  }

  if (!dragging) return;

  if (dragMode === 'lasso') {
    lasso.move(wx, wy);
    overlays.lassoPolygon = lasso.polygon;
  } else if (dragMode === 'path') {
    pathCapture.move(wx, wy);
    overlays.pathPreview = pathCapture.rawPath;
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;

  if (!dragging) {
    // Plain click: deselect if something was selected, otherwise nothing.
    if (hasSelection()) deselectAll();
    dragMode = 'none';
    return;
  }

  dragging = false;
  overlays.lassoPolygon = [];
  overlays.pathPreview = [];

  if (dragMode === 'lasso') {
    const poly = lasso.end();
    if (poly) {
      // Select all friendly units inside the lasso polygon.
      let count = 0;
      for (const u of state.units) {
        u.selected = u.owner === 'player' && pointInPolygon(u.pos.x, u.pos.y, poly);
        if (u.selected) count++;
      }
      if (count === 0) deselectAll();
    }
  } else if (dragMode === 'path') {
    const wps = pathCapture.end(CONFIG.INPUT.PATH_WAYPOINT_SPACING);
    if (wps) {
      for (const u of selectedUnits()) assignPath(u, wps.map((p) => ({ ...p })));
      overlays.groupPath = wps;
    }
  }

  dragMode = 'none';
});

// ── Keyboard hotkeys (BLUEPRINT.md §5.5) ────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  if (key === 'h') {
    renderer.showHashOverlay = !renderer.showHashOverlay;
    return;
  }

  if (key === 't') {
    renderer.showTerrainGrid = !renderer.showTerrainGrid;
    return;
  }

  if (key === ' ') {
    e.preventDefault();
    // Pause handled in loop (Space): toggle.
    loopPaused = !loopPaused;
    return;
  }

  if (key === 'escape') {
    deselectAll();
    lasso.cancel();
    pathCapture.cancel();
    overlays.lassoPolygon = [];
    overlays.pathPreview = [];
    dragging = false;
    dragMode = 'none';
    return;
  }

  if (key === 's') {
    // Stop selected units in place.
    for (const u of selectedUnits()) stopUnit(u);
    overlays.groupPath = [];
    return;
  }

  if (key === 'c') {
    // Clear orders: stop the units but keep them selected.
    for (const u of selectedUnits()) stopUnit(u);
    overlays.groupPath = [];
    return;
  }
});

// ── Pause support (Space) ────────────────────────────────────────────────────
let loopPaused = false;

// ── HUD ──────────────────────────────────────────────────────────────────────
const hud = document.getElementById('debug-hud') as HTMLDivElement;
let fpsSmoothed = 0;

// ── Game loop ─────────────────────────────────────────────────────────────────
const loop = new GameLoop({
  simTick: (dt) => {
    if (!loopPaused) stepMovement(state, hash, dt);
  },
  render: (alpha, frameDtMs) => {
    camera.update(frameDtMs);
    renderer.render(state, hash, alpha, overlays);

    if (frameDtMs > 0) {
      const fps = 1000 / frameDtMs;
      fpsSmoothed = fpsSmoothed === 0 ? fps : fpsSmoothed * 0.9 + fps * 0.1;
    }
    const sel = selectedUnits().length;
    hud.textContent =
      `DOTFRONT M2 · seed ${seed}${loopPaused ? ' · PAUSED' : ''}\n` +
      `${Math.round(fpsSmoothed)} fps · ${state.units.length} units · ${state.cities.length} cities · tick ${state.tick}\n` +
      `${sel} selected · ` +
      `[drag=lasso] [drag w/sel=path] [S=stop] [C=clear] [Esc=deselect] [Space=pause]\n` +
      `[T=terrain grid] [H=hash] · WASD/arrows/edges pan · wheel zooms`;
  },
});
loop.start();

// Re-export for tests that import from main (none currently, but keeps TS happy).
export { resamplePath, pointInPolygon };
