// M0 entry point: wires the deterministic sim to the camera and renderer
// through the fixed-timestep loop. Seed comes from `?seed=` so a given URL
// always reproduces the same drift pattern.

import { CONFIG } from './config';
import { GameLoop } from './core/loop';
import { hashSeed } from './core/rng';
import { SpatialHash } from './core/spatial-hash';
import { createInitialState, type Unit } from './core/state';
import { Camera } from './input/camera-input';
import { Renderer } from './render/renderer';
import { stepMovement } from './sim/movement';

function resolveSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || raw === '') return CONFIG.M0.DEFAULT_SEED;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber >>> 0 : hashSeed(raw);
}

const seed = resolveSeed();
const state = createInitialState(seed);
const hash = new SpatialHash<Unit>();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const camera = new Camera(state.world.width, state.world.height);
camera.attach(canvas);
const renderer = new Renderer(canvas, camera);
window.addEventListener('resize', () => renderer.resize());

// H toggles the spatial-hash occupancy overlay (BLUEPRINT.md rule 7).
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'h') renderer.showHashOverlay = !renderer.showHashOverlay;
});

const hud = document.getElementById('debug-hud') as HTMLDivElement;
let fps = 0;
let fpsSmoothed = 0;

const loop = new GameLoop({
  simTick: (dt) => stepMovement(state, hash, dt),
  render: (alpha, frameDtMs) => {
    camera.update(frameDtMs);
    renderer.render(state, hash, alpha);

    if (frameDtMs > 0) {
      fps = 1000 / frameDtMs;
      fpsSmoothed = fpsSmoothed === 0 ? fps : fpsSmoothed * 0.9 + fps * 0.1;
    }
    hud.textContent =
      `DOTFRONT M0 · seed ${seed}\n` +
      `${Math.round(fpsSmoothed)} fps · ${state.units.length} dots · tick ${state.tick}\n` +
      `WASD/arrows or screen edges pan · wheel zooms · H = hash overlay`;
  },
});
loop.start();
