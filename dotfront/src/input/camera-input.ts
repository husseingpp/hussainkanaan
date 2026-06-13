// Camera: pan/zoom over the world (BLUEPRINT.md §5.5). Lives outside the sim —
// it reads DOM input and owns the world↔screen transform the renderer uses.

import { CONFIG } from '../config';

export class Camera {
  /** World-space point shown at the center of the viewport. */
  x: number;
  y: number;
  zoom = 1;

  private viewW = 1;
  private viewH = 1;
  private readonly keys = new Set<string>();
  private readonly pointer = { x: 0, y: 0, inside: false };

  constructor(worldWidth: number, worldHeight: number) {
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;
  }

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    canvas.addEventListener('pointermove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.inside = true;
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Zoom toward the cursor so the point under it stays put.
        const before = this.screenToWorld(e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? CONFIG.CAMERA.ZOOM_STEP : 1 / CONFIG.CAMERA.ZOOM_STEP;
        this.zoom = clamp(this.zoom * factor, CONFIG.CAMERA.MIN_ZOOM, CONFIG.CAMERA.MAX_ZOOM);
        const after = this.screenToWorld(e.clientX, e.clientY);
        this.x += before.x - after.x;
        this.y += before.y - after.y;
      },
      { passive: false },
    );
  }

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** Apply keyboard + edge panning. Called once per rendered frame. */
  update(frameDtMs: number): void {
    const dt = frameDtMs / 1000;
    const panWorld = (CONFIG.CAMERA.PAN_SPEED / this.zoom) * dt;

    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    if (this.pointer.inside) {
      const m = CONFIG.CAMERA.EDGE_PAN_MARGIN;
      if (this.pointer.x < m) dx -= 1;
      else if (this.pointer.x > this.viewW - m) dx += 1;
      if (this.pointer.y < m) dy -= 1;
      else if (this.pointer.y > this.viewH - m) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * panWorld;
      this.y += (dy / len) * panWorld;
    }
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
