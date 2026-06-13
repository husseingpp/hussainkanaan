// Canvas 2D renderer (BLUEPRINT.md §4, §7). Reads state only — never mutates
// it. Interpolates each unit's drawn position between prevPos and pos by alpha.
// Everything drawn procedurally; the terrain is a pre-rendered image.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Owner, TerritoryData, Unit, Vec2 } from '../core/state';
import { UNIT_TYPES } from '../sim/unit-types';
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
  showTerritoryDebug = false;

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

  render(state: GameState, hash: SpatialHash<Unit>, alpha: number, overlays: RenderOverlays, frameDtMs = 0): void {
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

    // Territory tint drawn above terrain, below units (§5.6 / §7).
    if (state.territory) {
      if (this.showTerritoryDebug) this.drawTerritoryDebug(state.territory);
      else this.drawTerritoryTint(state.territory);
    }

    if (this.showTerrainGrid) this.drawTerrainGrid(state);
    if (this.showHashOverlay) this.drawHashOverlay(hash);

    this.drawCities(state);
    if (overlays.groupPath.length > 1) this.drawGroupPath(overlays.groupPath);
    this.drawTracers(state, frameDtMs);
    this.drawUnits(state, alpha);

    if (overlays.lassoPolygon.length > 1) this.drawLasso(overlays.lassoPolygon);
    if (overlays.pathPreview.length > 1) this.drawPathPreview(overlays.pathPreview);
  }

  /** Faint coloured fill (8% opacity) + 1.5px front-line border (§7). */
  private drawTerritoryTint(t: TerritoryData): void {
    const ctx = this.ctx;
    const { cols, rows, cellSize, ownership } = t;
    const z = this.camera.zoom;
    const borderW = 1.5 / z;

    ctx.globalAlpha = 0.08;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const code = ownership[r * cols + c]!;
        if (code === 0) continue; // neutral
        ctx.fillStyle = code === 1 ? CONFIG.COLORS.PLAYER : CONFIG.COLORS.ENEMY;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
    ctx.globalAlpha = 1;

    // Front-line border: draw between cells of different ownership.
    ctx.lineWidth = borderW;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const code = ownership[r * cols + c]!;
        if (code === 0 || code === 3) continue; // neutral or contested — no border from here
        const color = code === 1 ? CONFIG.COLORS.PLAYER : CONFIG.COLORS.ENEMY;
        // Check right neighbour.
        if (c + 1 < cols) {
          const right = ownership[r * cols + c + 1]!;
          if (right !== code) {
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo((c + 1) * cellSize, r * cellSize);
            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
        // Check bottom neighbour.
        if (r + 1 < rows) {
          const below = ownership[(r + 1) * cols + c]!;
          if (below !== code) {
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(c * cellSize, (r + 1) * cellSize);
            ctx.lineTo((c + 1) * cellSize, (r + 1) * cellSize);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  /** Debug overlay (D key): each region tinted a distinct hue. */
  private drawTerritoryDebug(t: TerritoryData): void {
    const ctx = this.ctx;
    const { cols, rows, cellSize, playerMap, enemyMap, regions } = t;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const pId = playerMap[idx]!;
        const eId = enemyMap[idx]!;
        const rId = pId >= 0 ? pId : eId >= 0 ? eId : -1;
        if (rId < 0) continue;
        const region = regions[rId];
        if (!region) continue;
        // Hue: golden-angle steps; pocket regions are desaturated.
        const hue = (rId * 137) % 360;
        const sat = region.isPocket ? 30 : 70;
        ctx.fillStyle = `hsl(${hue},${sat}%,60%)`;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        ctx.globalAlpha = 1;
      }
    }
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

      // Capture progress ring (§5.3): arc drawn by the captor's colour.
      if (city.captureBy !== null && city.captureProgress > 0) {
        const frac = city.captureProgress / CONFIG.ECONOMY.CAPTURE_TIME;
        const captorColor = OWNER_COLOR[city.captureBy];
        ctx.beginPath();
        ctx.arc(
          city.pos.x,
          city.pos.y,
          city.radius + 5 / this.camera.zoom,
          -Math.PI / 2,
          -Math.PI / 2 + frac * Math.PI * 2,
        );
        ctx.strokeStyle = captorColor;
        ctx.lineWidth = 3 / this.camera.zoom;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Production progress bar below city.
      if (city.productionQueue.length > 0) {
        const job = city.productionQueue[0]!;
        const frac = job.progress / UNIT_TYPES[job.kind].spawnTime;
        const z = this.camera.zoom;
        const w = city.radius * 2;
        const h = 3 / z;
        const bx = city.pos.x - w / 2;
        const by = city.pos.y + city.radius + 4 / z;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(bx, by, w, h);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(bx, by, w * frac, h);
        ctx.globalAlpha = 1;
      }
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
    const z = this.camera.zoom;

    for (const unit of state.units) {
      let x = unit.prevPos.x + (unit.pos.x - unit.prevPos.x) * alpha;
      let y = unit.prevPos.y + (unit.pos.y - unit.prevPos.y) * alpha;
      const color = OWNER_COLOR[unit.owner];
      const r = unit.radius;

      // Combat shake (visual only; render may use Math.random — not sim).
      if (unit.inCombat) {
        x += (Math.random() - 0.5) * amp;
        y += (Math.random() - 0.5) * amp;
      }

      if (unit.selected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / z;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      let unitAlpha = 1;
      if (unit.routTimer > 0) unitAlpha = 0.4 + 0.2 * Math.sin(state.tick);
      else if (unit.starving) unitAlpha = 0.5 + 0.15 * Math.sin(state.tick * 3);
      ctx.globalAlpha = unitAlpha;

      const fillColor = unit.flashTimer > 0 ? '#FFFFFF' : color;

      // Per-type shapes.
      if (unit.kind === 'infantry') {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
      } else if (unit.kind === 'tank') {
        const w = r * 1.8, h = r * 1.3;
        ctx.fillStyle = fillColor;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        // barrel stub
        ctx.fillRect(x - 1.5 / z, y - h / 2 - r * 0.7, 3 / z, r * 0.75);
      } else if (unit.kind === 'artillery') {
        // Filled triangle pointing up.
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.2);
        ctx.lineTo(x + r, y + r * 0.8);
        ctx.lineTo(x - r, y + r * 0.8);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
      } else {
        // drone: hollow diamond
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 1.5 / z;
        ctx.stroke();
        // small center dot
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // Squad number label above unit.
      if (unit.squadId !== null) {
        ctx.font = `${Math.round(8 / z)}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(unit.squadId), x, y - r - 1 / z);
      }

      // HP bar, only when damaged (§5.2).
      if (unit.hp < unit.maxHp && unit.hp > 0) {
        this.drawHpBar(x, y, r, unit.hp / unit.maxHp);
      }
    }
  }

  /** Draw short-lived gun-fire tracer lines and age them. Mutates state.tracers. */
  private drawTracers(state: GameState, frameDtMs: number): void {
    const ctx = this.ctx;
    const dur = CONFIG.UNIT.TRACER_DURATION_MS;
    const z = this.camera.zoom;

    for (const t of state.tracers) {
      const progress = t.ageMs / dur;
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.moveTo(t.from.x, t.from.y);
      ctx.lineTo(t.to.x, t.to.y);
      ctx.stroke();
      t.ageMs += frameDtMs;
    }
    ctx.globalAlpha = 1;

    // Remove expired tracers.
    const keep: typeof state.tracers = [];
    for (const t of state.tracers) {
      if (t.ageMs < dur) keep.push(t);
    }
    state.tracers = keep;
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
