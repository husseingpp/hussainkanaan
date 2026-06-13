// M1 entry point: wires lasso selection, path orders, and camera through the
// fixed-timestep loop. Seed from `?seed=` for deterministic replay.

import { CONFIG } from './config';
import { GameLoop } from './core/loop';
import { hashSeed } from './core/rng';
import { SpatialHash } from './core/spatial-hash';
import { createInitialState, type City, type Unit } from './core/state';
import { LassoCapture, pointInPolygon } from './input/lasso';
import { PathCapture, resamplePath } from './input/orders';
import { Camera } from './input/camera-input';
import { Renderer, type RenderOverlays } from './render/renderer';
import { createTerrainCanvas } from './render/terrain-layer';
import { computeSupply } from './sim/economy';
import { assignPath, stopUnit } from './sim/movement';
import { stepSimulation } from './sim/simulate';

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

// ── Production menu ───────────────────────────────────────────────────────────
let cityMenu: City | null = null;
const prodMenu = document.getElementById('city-menu') as HTMLDivElement;
const btnLight = document.getElementById('btn-light') as HTMLButtonElement;
const btnHeavy = document.getElementById('btn-heavy') as HTMLButtonElement;
const btnClose = document.getElementById('btn-close') as HTMLButtonElement;

function updateMenuButtons(): void {
  if (!cityMenu) return;
  const m = state.money.player;
  btnLight.textContent = `Light (${CONFIG.ECONOMY.LIGHT_COST}💰)`;
  btnHeavy.textContent = `Heavy (${CONFIG.ECONOMY.HEAVY_COST}💰)`;
  btnLight.disabled = m < CONFIG.ECONOMY.LIGHT_COST;
  btnHeavy.disabled = m < CONFIG.ECONOMY.HEAVY_COST;
}

function openCityMenu(city: City): void {
  cityMenu = city;
  const screen = camera.worldToScreen(city.pos.x, city.pos.y);
  prodMenu.style.left = `${screen.x + 30}px`;
  prodMenu.style.top = `${screen.y - 30}px`;
  prodMenu.style.display = 'flex';
  updateMenuButtons();
}

function closeCityMenu(): void {
  cityMenu = null;
  prodMenu.style.display = 'none';
}

btnClose.addEventListener('click', closeCityMenu);

btnLight.addEventListener('click', () => {
  if (!cityMenu || state.money.player < CONFIG.ECONOMY.LIGHT_COST) return;
  state.money.player -= CONFIG.ECONOMY.LIGHT_COST;
  cityMenu.productionQueue.push({ kind: 'light', progress: 0, rallyPoint: null });
  closeCityMenu();
});

btnHeavy.addEventListener('click', () => {
  if (!cityMenu || state.money.player < CONFIG.ECONOMY.HEAVY_COST) return;
  state.money.player -= CONFIG.ECONOMY.HEAVY_COST;
  cityMenu.productionQueue.push({ kind: 'heavy', progress: 0, rallyPoint: null });
  closeCityMenu();
});

function selectedUnits(): Unit[] {
  return state.units.filter((u) => u.selected);
}

/** Units the player may currently order (selected, alive, not routing). */
function controllableSelected(): Unit[] {
  return state.units.filter((u) => u.selected && u.routTimer <= 0 && u.hp > 0);
}

function hasSelection(): boolean {
  return state.units.some((u) => u.selected);
}

function deselectAll(): void {
  for (const u of state.units) u.selected = false;
  overlays.groupPath = [];
}

/** Quick move order: send every selected unit toward a single target point. */
function issueMoveOrder(tx: number, ty: number): void {
  const sel = controllableSelected();
  if (sel.length === 0) return;
  let cx = 0;
  let cy = 0;
  for (const u of sel) {
    assignPath(u, [{ x: tx, y: ty }]);
    cx += u.pos.x;
    cy += u.pos.y;
  }
  // Draw a line from the group's centroid to the target as feedback.
  overlays.groupPath = [{ x: cx / sel.length, y: cy / sel.length }, { x: tx, y: ty }];
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
    const { x: wx, y: wy } = camera.screenToWorld(e.clientX, e.clientY);

    // Click on an owned city → open production menu (takes priority over move).
    const clickedCity = state.cities.find((c) => {
      if (c.owner !== 'player') return false;
      const dx = c.pos.x - wx;
      const dy = c.pos.y - wy;
      return Math.sqrt(dx * dx + dy * dy) <= c.radius;
    });
    if (clickedCity) {
      openCityMenu(clickedCity);
      dragMode = 'none';
      return;
    }

    closeCityMenu();

    // Plain click with a selection = quick move order to that point.
    if (hasSelection()) {
      issueMoveOrder(wx, wy);
    }
    dragMode = 'none';
    return;
  }

  dragging = false;
  overlays.lassoPolygon = [];
  overlays.pathPreview = [];

  if (dragMode === 'lasso') {
    const poly = lasso.end();
    if (poly) {
      // Select all friendly (player) units inside the lasso polygon.
      let count = 0;
      for (const u of state.units) {
        u.selected = u.owner === 'player' && u.hp > 0 && pointInPolygon(u.pos.x, u.pos.y, poly);
        if (u.selected) count++;
      }
      if (count === 0) deselectAll();
    }
  } else if (dragMode === 'path') {
    const wps = pathCapture.end(CONFIG.INPUT.PATH_WAYPOINT_SPACING);
    if (wps) {
      for (const u of controllableSelected()) assignPath(u, wps.map((p) => ({ ...p })));
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
    closeCityMenu();
    deselectAll();
    lasso.cancel();
    pathCapture.cancel();
    overlays.lassoPolygon = [];
    overlays.pathPreview = [];
    dragging = false;
    dragMode = 'none';
    return;
  }

  if (key === 's' || key === 'c') {
    // Stop / clear orders for controllable selected units (keep them selected).
    for (const u of controllableSelected()) stopUnit(u);
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
    if (!loopPaused) stepSimulation(state, hash, dt);
  },
  render: (alpha, frameDtMs) => {
    camera.update(frameDtMs);
    renderer.render(state, hash, alpha, overlays);

    if (frameDtMs > 0) {
      const fps = 1000 / frameDtMs;
      fpsSmoothed = fpsSmoothed === 0 ? fps : fpsSmoothed * 0.9 + fps * 0.1;
    }
    const sel = selectedUnits().length;
    let blue = 0;
    let red = 0;
    for (const u of state.units) {
      if (u.owner === 'player') blue++;
      else if (u.owner === 'enemy') red++;
    }
    const { fieldWeight: pField, capacity: pCap } = computeSupply(state.units, state.cities, 'player');
    const blueCities = state.cities.filter((c) => c.owner === 'player').length;
    hud.textContent =
      `DOTFRONT M4 · seed ${seed}${loopPaused ? ' · PAUSED' : ''}\n` +
      `${Math.round(fpsSmoothed)} fps · blue ${blue} vs red ${red} · ${sel} selected · tick ${state.tick}\n` +
      `💰 ${Math.floor(state.money.player)} · supply ${pField}/${pCap} · cities ${blueCities}\n` +
      `click city=produce · click=move · drag=lasso · drag w/sel=path · S=stop · Esc=deselect\n` +
      `[T=terrain grid] [H=hash] · WASD/arrows/edges pan · wheel zooms`;
  },
});
loop.start();

// Re-export for tests that import from main (none currently, but keeps TS happy).
export { resamplePath, pointInPolygon };
