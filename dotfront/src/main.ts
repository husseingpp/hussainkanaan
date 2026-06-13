// M1 entry point: wires lasso selection, path orders, and camera through the
// fixed-timestep loop. Seed from `?seed=` for deterministic replay.

import { CONFIG } from './config';
import { GameLoop } from './core/loop';
import { hashSeed } from './core/rng';
import { SpatialHash } from './core/spatial-hash';
import { createInitialState, type City, type FormationType, type Unit } from './core/state';
import { LassoCapture, pointInPolygon } from './input/lasso';
import { PathCapture, resamplePath } from './input/orders';
import { Camera } from './input/camera-input';
import { Renderer, type RenderOverlays } from './render/renderer';
import { createTerrainCanvas } from './render/terrain-layer';
import { computeSupply } from './sim/economy';
import { assignPath, stopUnit } from './sim/movement';
import { formationWaypoint } from './sim/formations';
import { UNIT_TYPES, type UnitKind } from './sim/unit-types';
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
const btnClose = document.getElementById('btn-close') as HTMLButtonElement;

const PROD_KINDS: UnitKind[] = ['infantry', 'tank', 'artillery', 'drone'];
const prodBtns: Record<UnitKind, HTMLButtonElement> = {
  infantry:  document.getElementById('btn-infantry')  as HTMLButtonElement,
  tank:      document.getElementById('btn-tank')      as HTMLButtonElement,
  artillery: document.getElementById('btn-artillery') as HTMLButtonElement,
  drone:     document.getElementById('btn-drone')     as HTMLButtonElement,
};

function updateMenuButtons(): void {
  if (!cityMenu) return;
  const m = state.money.player;
  for (const kind of PROD_KINDS) {
    const def = UNIT_TYPES[kind];
    prodBtns[kind].textContent = `${def.displayName} (${def.cost}💰)`;
    prodBtns[kind].disabled = m < def.cost;
  }
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

for (const kind of PROD_KINDS) {
  prodBtns[kind].addEventListener('click', () => {
    const def = UNIT_TYPES[kind];
    if (!cityMenu || state.money.player < def.cost) return;
    state.money.player -= def.cost;
    cityMenu.productionQueue.push({ kind, progress: 0, rallyPoint: null });
    closeCityMenu();
  });
}

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

// ── Squad helpers ────────────────────────────────────────────────────────────

function assignSquad(units: Unit[], squadId: number): void {
  let squad = state.squads.find((s) => s.id === squadId);
  if (!squad) {
    squad = { id: squadId, owner: 'player', formation: 'line' };
    state.squads.push(squad);
  }
  // Reassign only the provided units; preserve existing slots for others.
  let slot = 0;
  for (const u of units) {
    u.squadId = squadId;
    u.squadSlot = slot++;
  }
}

function selectSquad(squadId: number): void {
  deselectAll();
  for (const u of state.units) {
    if (u.owner === 'player' && u.hp > 0 && u.squadId === squadId) u.selected = true;
  }
  overlays.groupPath = [];
}

function selectedSquadId(): number | null {
  const sel = state.units.filter((u) => u.selected && u.owner === 'player');
  if (sel.length === 0) return null;
  const id = sel[0]!.squadId;
  if (id === null) return null;
  return sel.every((u) => u.squadId === id) ? id : null;
}

function cycleFormation(squadId: number | null): void {
  if (squadId === null) return;
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) return;
  const order: FormationType[] = ['line', 'column', 'wedge', 'box'];
  const idx = order.indexOf(squad.formation);
  squad.formation = order[(idx + 1) % order.length]!;
}

/** Quick move order: send every selected unit toward a target point.
 *  If all selected units share a squad, their waypoints are offset into formation. */
function issueMoveOrder(tx: number, ty: number): void {
  const sel = controllableSelected();
  if (sel.length === 0) return;

  let cx = 0;
  let cy = 0;
  for (const u of sel) { cx += u.pos.x; cy += u.pos.y; }
  cx /= sel.length;
  cy /= sel.length;

  // Compute facing vector from centroid to target.
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy);
  const fx = len > 0 ? dx / len : 0;
  const fy = len > 0 ? dy / len : 1;

  // Formation: apply if all selected units share one squad.
  const squadId = selectedSquadId();
  const squad = squadId !== null ? state.squads.find((s) => s.id === squadId) : null;

  for (const u of sel) {
    let wp: { x: number; y: number };
    if (squad) {
      wp = formationWaypoint(
        { x: tx, y: ty }, fx, fy,
        u.squadSlot, sel.length, squad.formation, CONFIG.UNIT.FORMATION_SPACING,
      );
    } else {
      wp = { x: tx, y: ty };
    }
    assignPath(u, [wp]);
  }

  overlays.groupPath = [{ x: cx, y: cy }, { x: tx, y: ty }];
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
      const sel = controllableSelected();
      const squadId = selectedSquadId();
      const squad = squadId !== null ? state.squads.find((s) => s.id === squadId) : null;
      const last = wps[wps.length - 1]!;
      const prev = wps[wps.length - 2] ?? wps[0]!;
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const len = Math.hypot(dx, dy);
      const fx = len > 0 ? dx / len : 0;
      const fy = len > 0 ? dy / len : 1;
      for (const u of sel) {
        const path = wps.slice(0, -1).map((p) => ({ ...p }));
        const finalWp = squad
          ? formationWaypoint(last, fx, fy, u.squadSlot, sel.length, squad.formation, CONFIG.UNIT.FORMATION_SPACING)
          : { ...last };
        path.push(finalWp);
        assignPath(u, path);
      }
      overlays.groupPath = wps;
    }
  }

  dragMode = 'none';
});

// ── Keyboard hotkeys (BLUEPRINT.md §5.5) ────────────────────────────────────
window.addEventListener('keydown', (e) => {
  // Ignore game hotkeys while typing in a text field or before the match starts.
  if (e.target instanceof HTMLInputElement) return;
  if (!gameStarted) return;

  // Ctrl+1–9: assign selected units to a numbered squad.
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    assignSquad(selectedUnits().filter((u) => u.owner === 'player'), Number(e.key));
    return;
  }
  // 1–9: select an existing squad.
  if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
    selectSquad(Number(e.key));
    return;
  }

  const key = e.key.toLowerCase();

  if (key === 'h') {
    renderer.showHashOverlay = !renderer.showHashOverlay;
    return;
  }

  if (key === 't') {
    renderer.showTerrainGrid = !renderer.showTerrainGrid;
    return;
  }

  if (key === 'd') {
    renderer.showTerritoryDebug = !renderer.showTerritoryDebug;
    return;
  }

  if (key === 'f') {
    cycleFormation(selectedSquadId());
    return;
  }

  if (key === '`') {
    const dh = document.getElementById('debug-hud') as HTMLDivElement;
    dh.style.display = dh.style.display === 'block' ? 'none' : 'block';
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

// ── Start screen ──────────────────────────────────────────────────────────────
let gameStarted = false;
const startScreen = document.getElementById('start-screen') as HTMLDivElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const seedInput = document.getElementById('seed-input') as HTMLInputElement;
seedInput.value = String(seed);

function startGame(): void {
  const entered = seedInput.value.trim();
  // A different seed means a different map — reload to regenerate from scratch.
  if (entered !== '' && entered !== String(seed)) {
    window.location.href = `?seed=${encodeURIComponent(entered)}`;
    return;
  }
  gameStarted = true;
  startScreen.style.display = 'none';
  // Re-center on the player capital in case stray input nudged the camera.
  if (playerCapital) {
    camera.x = playerCapital.pos.x;
    camera.y = playerCapital.pos.y;
  }
}

btnPlay.addEventListener('click', startGame);
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});

// ── End screen ───────────────────────────────────────────────────────────────
const endScreen = document.getElementById('end-screen') as HTMLDivElement;
const endTitle = document.getElementById('end-title') as HTMLDivElement;
const endStats = document.getElementById('end-stats') as HTMLDivElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;

btnRestart.addEventListener('click', () => {
  // New random seed for a fresh map.
  window.location.href = `?seed=${Math.floor(Math.random() * 0xFFFFFF)}`;
});

function maybeShowEndScreen(): void {
  if (state.matchPhase === 'playing' || endScreen.style.display === 'flex') return;
  const labels = { won: 'VICTORY', lost: 'DEFEAT', draw: 'DRAW' } as const;
  const phase = state.matchPhase as 'won' | 'lost' | 'draw';
  endTitle.textContent = labels[phase];
  endTitle.className = phase;
  const mins = Math.floor(state.matchTime / 60);
  const secs = String(Math.floor(state.matchTime % 60)).padStart(2, '0');
  const blue = state.units.filter((u) => u.owner === 'player' && u.hp > 0).length;
  const blueCities = state.cities.filter((c) => c.owner === 'player').length;
  const total = state.cities.length;
  endStats.textContent = `${mins}:${secs} · ${blue} units left · ${blueCities}/${total} cities`;
  endScreen.style.display = 'flex';
}

// ── HUD ──────────────────────────────────────────────────────────────────────
const hudTimer = document.getElementById('hud-timer') as HTMLDivElement;
const hudMoney = document.getElementById('hud-money') as HTMLSpanElement;
const hudSupply = document.getElementById('hud-supply') as HTMLSpanElement;
const hudCities = document.getElementById('hud-cities') as HTMLSpanElement;
const hudWarn = document.getElementById('hud-warn') as HTMLDivElement;
const debugHud = document.getElementById('debug-hud') as HTMLDivElement;
let fpsSmoothed = 0;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function updateHud(frameDtMs: number): void {
  if (frameDtMs > 0) {
    const fps = 1000 / frameDtMs;
    fpsSmoothed = fpsSmoothed === 0 ? fps : fpsSmoothed * 0.9 + fps * 0.1;
  }

  const { fieldWeight: pField, capacity: pCap } = computeSupply(state.units, state.cities, 'player');
  const blueCities = state.cities.filter((c) => c.owner === 'player').length;
  const pPockets = state.territory?.regions.filter((r) => r.owner === 'player' && r.isPocket).length ?? 0;

  hudTimer.textContent = `${formatTime(state.matchTime)}${loopPaused ? ' · PAUSED' : ''}`;
  hudMoney.textContent = `💰 ${Math.floor(state.money.player)}`;
  hudSupply.textContent = `▦ ${pField}/${pCap}`;
  hudSupply.style.color = pField > pCap ? '#e5484d' : '#4a4a4a';
  hudCities.textContent = `⌂ ${blueCities}`;
  const squadId = selectedSquadId();
  const squadInfo = squadId !== null
    ? state.squads.find((s) => s.id === squadId)
    : null;
  const formationLabel = squadInfo ? ` · [F] ${squadInfo.formation}` : '';
  hudWarn.textContent = pPockets > 0
    ? `⚠ ${pPockets} squad${pPockets > 1 ? 's' : ''} cut off — starving${formationLabel}`
    : formationLabel.slice(3); // strip ' · ' prefix when no pocket warning

  if (debugHud.style.display === 'block') {
    let blue = 0;
    let red = 0;
    for (const u of state.units) {
      if (u.owner === 'player') blue++;
      else if (u.owner === 'enemy') red++;
    }
    const sel = selectedUnits().length;
    debugHud.textContent =
      `seed ${seed} · ${Math.round(fpsSmoothed)} fps · tick ${state.tick}\n` +
      `blue ${blue} vs red ${red} · ${sel} selected\n` +
      `[T] terrain · [H] hash · [D] territory`;
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────────
const loop = new GameLoop({
  simTick: (dt) => {
    if (gameStarted && !loopPaused && state.matchPhase === 'playing') stepSimulation(state, hash, dt);
  },
  render: (alpha, frameDtMs) => {
    camera.update(frameDtMs);
    renderer.render(state, hash, alpha, overlays, frameDtMs);
    if (gameStarted) maybeShowEndScreen();
    updateHud(frameDtMs);
  },
});
loop.start();

// Re-export for tests that import from main (none currently, but keeps TS happy).
export { resamplePath, pointInPolygon };
