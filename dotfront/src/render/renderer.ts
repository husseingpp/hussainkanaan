// Canvas 2D renderer (BLUEPRINT.md §4, §7). Reads state only — never mutates
// it. Interpolates each unit's drawn position between prevPos and pos by alpha.
// Everything drawn procedurally; no images or sprites.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Owner, Unit, Vec2 } from '../core/state';
import type { Camera } from '../input/camera-input';

export interface RenderOverlays {
  /** Active lasso polygon being drawn (world coords). */
  lassoPolygon: readonly Vec2[];
  /** Active path stroke being drawn (world coords). */
  pathPreview: readonly Vec2[];
  /** Last confirmed waypoint path for the selected group. */
  groupPath: readonly Vec2[];
}

const OWNER_COLOR: Record<Owner, string> = {
  player: CONFIG.COLORS.PLAYER,
  enemy:  CONFIG.COLORS.ENEMY,
  neutral: CONFIG.COLORS.NEUTRAL,
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  cssWidth = 1;
  cssHeight = 1;

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

  render(
    state: GameState,
    hash: SpatialHash<Unit>,
    alpha: number,
    overlays: RenderOverlays,
  ): void {
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawWorldBorder(state);
    if (this.showHashOverlay) this.drawHashOverlay(hash);

    // Group path (confirmed waypoints for selected units).
    if (overlays.groupPath.length > 1) this.drawGroupPath(overlays.groupPath);

    this.drawUnits(state, alpha);

    // Overlays drawn on top of units.
    if (overlays.lassoPolygon.length > 1) this.drawLasso(overlays.lassoPolygon);
    if (overlays.pathPreview.length > 1) this.drawPathPreview(overlays.pathPreview);
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
    for (const { cx, cy, count } of hash.occupancy()) {
      const x = cx * size;
      const y = cy * size;
      ctx.fillStyle = CONFIG.COLORS.DEBUG_HASH_FILL;
      ctx.globalAlpha = Math.min(0.12 + count * 0.12, 0.6);
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, size, size);
    }
  }

  private drawGroupPath(path: readonly Vec2[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.setLineDash([6 / this.camera.zoom, 6 / this.camera.zoom]);
    ctx.strokeStyle = CONFIG.COLORS.PLAYER;
    ctx.lineWidth = 1.5 / this.camera.zoom;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private drawUnits(state: GameState, alpha: number): void {
    const ctx = this.ctx;

    for (const unit of state.units) {
      const x = unit.prevPos.x + (unit.pos.x - unit.prevPos.x) * alpha;
      const y = unit.prevPos.y + (unit.pos.y - unit.prevPos.y) * alpha;

      // Selection ring drawn first (under the dot).
      if (unit.selected) {
        ctx.beginPath();
        ctx.arc(x, y, unit.radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = OWNER_COLOR[unit.owner];
        ctx.lineWidth = 1.5 / this.camera.zoom;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(x, y, unit.radius, 0, Math.PI * 2);
      ctx.fillStyle = OWNER_COLOR[unit.owner];
      ctx.fill();
    }
  }

  private drawLasso(poly: readonly Vec2[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
    ctx.closePath();
    // Faint fill so the enclosed area is obvious.
    ctx.fillStyle = CONFIG.COLORS.PLAYER;
    ctx.globalAlpha = 0.06;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Dashed outline.
    ctx.setLineDash([5 / this.camera.zoom, 4 / this.camera.zoom]);
    ctx.strokeStyle = CONFIG.COLORS.PLAYER;
    ctx.lineWidth = 1.5 / this.camera.zoom;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private drawPathPreview(path: readonly Vec2[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.strokeStyle = CONFIG.COLORS.PLAYER;
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.globalAlpha = 0.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Arrow tip at the end.
    const a = path[path.length - 2]!;
    const b = path[path.length - 1]!;
    this.drawArrow(a.x, a.y, b.x, b.y);
  }

  private drawArrow(ax: number, ay: number, bx: number, by: number): void {
    const ctx = this.ctx;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    const sz = 10 / this.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - ux * sz - uy * sz * 0.5, by - uy * sz + ux * sz * 0.5);
    ctx.lineTo(bx - ux * sz + uy * sz * 0.5, by - uy * sz - ux * sz * 0.5);
    ctx.closePath();
    ctx.fillStyle = CONFIG.COLORS.PLAYER;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
