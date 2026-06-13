// Canvas 2D renderer (BLUEPRINT.md §4, §7). Reads state only — never mutates
// it. Interpolates each unit's drawn position between prevPos and pos by alpha
// for smooth 60fps motion over 20 TPS sim. Everything drawn procedurally.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Owner, Unit } from '../core/state';
import type { Camera } from '../input/camera-input';

const OWNER_COLOR: Record<Owner, string> = {
  player: CONFIG.COLORS.PLAYER,
  enemy: CONFIG.COLORS.ENEMY,
  neutral: CONFIG.COLORS.NEUTRAL,
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  cssWidth = 1;
  cssHeight = 1;

  /** Debug overlays (BLUEPRINT.md rule 7). M0 ships the H = spatial hash one. */
  showHashOverlay = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.camera.setViewport(this.cssWidth, this.cssHeight);
  }

  render(state: GameState, hash: SpatialHash<Unit>, alpha: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    // Reset to device pixels, clear paper background.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // World→screen camera transform (in CSS pixels, on top of the DPR scale).
    ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawWorldBorder(state);
    if (this.showHashOverlay) this.drawHashOverlay(hash);
    this.drawUnits(state, alpha);
  }

  private drawWorldBorder(state: GameState): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeStyle = CONFIG.COLORS.WORLD_BORDER;
    ctx.strokeRect(0, 0, state.world.width, state.world.height);
  }

  private drawHashOverlay(hash: SpatialHash<Unit>): void {
    const ctx = this.ctx;
    const size = hash.cellSize;
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.strokeStyle = CONFIG.COLORS.DEBUG_HASH_GRID;
    ctx.fillStyle = CONFIG.COLORS.DEBUG_HASH_FILL;
    for (const { cx, cy, count } of hash.occupancy()) {
      const x = cx * size;
      const y = cy * size;
      // Opacity hints at occupancy without needing a legend.
      ctx.globalAlpha = Math.min(0.12 + count * 0.12, 0.6);
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, size, size);
    }
  }

  private drawUnits(state: GameState, alpha: number): void {
    const ctx = this.ctx;
    for (const unit of state.units) {
      const x = unit.prevPos.x + (unit.pos.x - unit.prevPos.x) * alpha;
      const y = unit.prevPos.y + (unit.pos.y - unit.prevPos.y) * alpha;
      ctx.beginPath();
      ctx.arc(x, y, unit.radius, 0, Math.PI * 2);
      ctx.fillStyle = OWNER_COLOR[unit.owner];
      ctx.fill();
    }
  }
}
