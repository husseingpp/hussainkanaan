// Seeded 2D Perlin noise + fBm for map generation. Pure and deterministic: the
// permutation table is shuffled with the seeded RNG (BLUEPRINT.md §3). No
// Math.random, no external dependency (keeps the bundle tiny, §8).

import type { Rng } from '../core/rng';

export class Noise2D {
  private readonly perm = new Uint8Array(512);

  constructor(rng: Rng) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle using the seeded RNG.
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]!;
      p[i] = p[j]!;
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }

  /** Perlin noise in roughly [-1, 1]. */
  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = Noise2D.fade(xf);
    const v = Noise2D.fade(yf);
    const p = this.perm;

    const aa = p[p[xi]! + yi]!;
    const ab = p[p[xi]! + yi + 1]!;
    const ba = p[p[xi + 1]! + yi]!;
    const bb = p[p[xi + 1]! + yi + 1]!;

    const x1 = Noise2D.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = Noise2D.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return Noise2D.lerp(x1, x2, v);
  }

  /** Fractal Brownian motion, normalised to roughly [0, 1]. */
  fbm(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= 2;
    }
    return (total / max) * 0.5 + 0.5;
  }
}
