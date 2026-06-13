// Canvas 2D renderer (BLUEPRINT.md §4, §7). Reads state only — never mutates
// it. Interpolates each unit's drawn position between prevPos and pos by alpha.
// Everything drawn procedurally; the terrain is a pre-rendered image.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Owner, Unit, Vec2 } from '../core/state';
import type { Camera } from '../input/camera-input';

export interface RenderOverlays {
  lassoPolygon: readonly Vec2[];
  pathPreview: readonly Vec2[];
  groupPath: readonly Vec2[];
}

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

  private terrainCanvas: HTMLCanvasElement | null = null;

  showHashOverlay = false;
  showTerrainGrid = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  setTerrain(canvas: HTMLCanvasElement): void {
    this.terrainCanvas = canvas;
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

  render(state: GameState, hash: SpatialHash<Unit>, alpha: number, overlays: RenderOverlays): void {
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    if (this.terrainCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.terrainCanvas, 0, 0);
    }
    this.drawWorldBorder(state);

    if (this.showTerrainGrid) this.drawTerrainGrid(state);
    if (this.showHashOverlay) this.drawHashOverlay(hash);

    this.drawCities(state);
    if (overlays.groupPath.length > 1) this.drawGroupPath(overlays.groupPath);
    this.drawUnits(state, alpha);

    if (overlays.lassoPolygon.length > 1) this.drawLasso(overlays.lassoPolygon);
    if (overlays.pathPreview.length > 1) this.drawPathPreview(overlays.pathPreview);
  }

  private drawWorldBorder(state: GameState): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeStyle = CONFIG.COLORS.WORLD_BORDER;
    ctx.strokeRect(0, 0, state.world.width, state.world.height);
  }

  private drawTerrainGrid(state: GameState): void {
    const ctx = this.ctx;
    const { cellSize, cols, rows } = state.terrain;
    ctx.strokeStyle = CONFIG.COLORS.DEBUG_TERRAIN_GRID;
    ctx.lineWidth = 0.5 / this.camera.zoom;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, rows * cellSize);
    }
    for (let r = 0; r <= rows; r++) {
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(cols * cellSize, r * cellSize);
    }
    ctx.stroke();
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

  private drawCities(state: GameState): void {
    const ctx = this.ctx;
    for (const city of state.cities) {
      const color = OWNER_COLOR[city.owner];
      ctx.beginPath();
      ctx.arc(city.pos.x, city.pos.y, city.radius, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.CITY_FILL;
      ctx.fill();
      ctx.lineWidth = 2.5 / this.camera.zoom;
      ctx.strokeStyle = color;
      ctx.stroke();
      if (city.isCapital) this.drawStar(city.pos, city.radius * 0.55, color);
    }
  }

  private drawStar(c: Vec2, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const x = c.x + Math.cos(ang) * rad;
      const y = c.y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
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
    const amp = CONFIG.COMBAT.SHAKE_AMPLITUDE;

    for (const unit of state.units) {
      let x = unit.prevPos.x + (unit.pos.x - unit.prevPos.x) * alpha;
      let y = unit.prevPos.y + (unit.pos.y - unit.prevPos.y) * alpha;
      const color = OWNER_COLOR[unit.owner];

      // Combat shake (visual only; render may use Math.random — not sim).
      if (unit.inCombat) {
        x += (Math.random() - 0.5) * amp;
        y += (Math.random() - 0.5) * amp;
      }

      if (unit.selected) {
        ctx.beginPath();
        ctx.arc(x, y, unit.radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(x, y, unit.radius, 0, Math.PI * 2);
      // Routing units flicker/fade (§7 starvation-style juice).
      ctx.globalAlpha = unit.routTimer > 0 ? 0.4 + 0.2 * Math.sin(state.tick) : 1;
      ctx.fillStyle = unit.flashTimer > 0 ? '#FFFFFF' : color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Heavy units get an inner ring (§5.1).
      if (unit.kind === 'heavy') {
        ctx.beginPath();
        ctx.arc(x, y, unit.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = unit.flashTimer > 0 ? color : CONFIG.COLORS.BACKGROUND;
        ctx.fill();
      }

      // HP bar, only when damaged (§5.2).
      if (unit.hp < unit.maxHp && unit.hp > 0) {
        this.drawHpBar(x, y, unit.radius, unit.hp / unit.maxHp);
      }
    }
  }

  private drawHpBar(x: number, y: number, radius: number, frac: number): void {
    const ctx = this.ctx;
    const z = this.camera.zoom;
    const w = 14 / z;
    const h = 2.5 / z;
    const bx = x - w / 2;
    const by = y - radius - 5 / z;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx, by, w, h);
    // Green → red as HP drops.
    const r = Math.round(229 + (46 - 229) * frac);
    const g = Math.round(72 + (160 - 72) * frac);
    ctx.fillStyle = `rgb(${r},${g},90)`;
    ctx.fillRect(bx, by, w * frac, h);
  }

  private drawLasso(poly: readonly Vec2[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
    ctx.closePath();
    ctx.fillStyle = CONFIG.COLORS.PLAYER;
    ctx.globalAlpha = 0.06;
    ctx.fill();
    ctx.globalAlpha = 1;
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
