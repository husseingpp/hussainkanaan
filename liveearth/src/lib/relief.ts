// Hypsometric (elevation-tinted) colouring derived purely from a grayscale
// heightmap — no photographic Earth imagery. Kept free of any `three` import so
// the colour ramp stays a pure, unit-testable function.

export type RGB = [number, number, number];

interface Stop {
  at: number; // 0..1 position along the ramp
  color: RGB;
}

// Anything at/below this normalized elevation is treated as ocean.
// Kept low so coastlines stay tight and continents read as land, not sea.
export const SEA_LEVEL = 0.012;

// Cyberpunk cyan→magenta ramp (no natural-earth colours).
const OCEAN: Stop[] = [
  { at: 0, color: [1, 3, 10] }, // near-black deep
  { at: 1, color: [6, 50, 71] }, // subtle cyan shallows
];

const LAND: Stop[] = [
  { at: 0.0, color: [7, 59, 70] }, // dark teal coast
  { at: 0.18, color: [19, 196, 214] }, // neon cyan lowland
  { at: 0.42, color: [79, 59, 214] }, // indigo
  { at: 0.68, color: [192, 38, 212] }, // magenta highland
  { at: 0.86, color: [255, 90, 242] }, // hot pink
  { at: 1.0, color: [243, 249, 255] }, // white-hot peaks
];

// Spread the heightmap's compressed land range so the neon tones (and peaks) read.
const LAND_CONTRAST = 0.7;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sample(stops: Stop[], x: number): RGB {
  const v = Math.max(0, Math.min(1, x));
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (v <= s1.at) {
      const span = s1.at - s0.at || 1;
      const t = (v - s0.at) / span;
      return [
        Math.round(lerp(s0.color[0], s1.color[0], t)),
        Math.round(lerp(s0.color[1], s1.color[1], t)),
        Math.round(lerp(s0.color[2], s1.color[2], t)),
      ];
    }
  }
  return stops[stops.length - 1].color;
}

/**
 * Map a normalized elevation (0 = deepest ocean … 1 = highest peak) to a
 * hypsometric tint: blue oceans → green lowlands → brown mountains → white peaks.
 */
export function elevationColor(t: number): RGB {
  if (t < SEA_LEVEL) return sample(OCEAN, t / SEA_LEVEL);
  const u = (t - SEA_LEVEL) / (1 - SEA_LEVEL);
  return sample(LAND, Math.pow(Math.max(0, Math.min(1, u)), LAND_CONTRAST));
}

/** Land-only ramp (never returns an ocean colour) — used when a mask has already
 * confirmed the pixel is land, so even low elevations stay on the neon land ramp. */
export function landColor(t: number): RGB {
  return sample(LAND, Math.pow(Math.max(0, Math.min(1, t)), LAND_CONTRAST));
}

/** Ocean ramp by depth (0 = deepest … 1 = shallow). */
export function oceanColor(t: number): RGB {
  return sample(OCEAN, t);
}

/** Decide whether "water" pixels are the bright ones in a land/ocean mask, by
 * comparing a known-ocean sample to a known-land sample. Robust to either
 * polarity of the asset. */
export function waterIsBright(oceanLum: number, landLum: number): boolean {
  return oceanLum >= landLum;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lonLatToIndex(lng: number, lat: number, w: number, h: number): number {
  const x = Math.min(w - 1, Math.max(0, Math.round(((lng + 180) / 360) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.round(((90 - lat) / 180) * h)));
  return (y * w + x) * 4;
}

function drawScaled(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export interface ReliefTextures {
  /** sRGB colour map: dark seas + neon land. */
  colorCanvas: HTMLCanvasElement;
  /** Linear displacement/bump map: 0 over oceans (flat), elevation over land. */
  dispCanvas: HTMLCanvasElement;
}

/**
 * Composite an elevation heightmap + a land/ocean mask into a colour canvas and
 * a displacement canvas (browser-only). The mask decides sea vs land definitively
 * (so oceans don't swallow low-lying land), with auto-detected polarity. Oceans
 * are flattened (displacement 0) and tinted dark; land keeps its elevation relief
 * and the neon hypsometric tint.
 */
export function buildReliefTextures(
  topoImg: HTMLImageElement,
  waterImg: HTMLImageElement,
  maxWidth = 2048,
): ReliefTextures | null {
  const srcW = topoImg.naturalWidth || topoImg.width;
  const srcH = topoImg.naturalHeight || topoImg.height;
  const scale = srcW > maxWidth ? maxWidth / srcW : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const topo = drawScaled(topoImg, w, h);
  const water = drawScaled(waterImg, w, h);
  if (!topo || !water) return null;

  // Auto-detect mask polarity from a known-ocean and known-land sample.
  const oceanIdx = lonLatToIndex(-150, 0, w, h); // mid-Pacific
  const landIdx = lonLatToIndex(10, 22, w, h); // Sahara
  const oceanLum = luminance(water[oceanIdx], water[oceanIdx + 1], water[oceanIdx + 2]);
  const landLum = luminance(water[landIdx], water[landIdx + 1], water[landIdx + 2]);
  const bright = waterIsBright(oceanLum, landLum);
  const mid = (oceanLum + landLum) / 2;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = w;
  colorCanvas.height = h;
  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = w;
  dispCanvas.height = h;
  const colorCtx = colorCanvas.getContext("2d");
  const dispCtx = dispCanvas.getContext("2d");
  if (!colorCtx || !dispCtx) return null;

  const colorImg = colorCtx.createImageData(w, h);
  const dispImg = dispCtx.createImageData(w, h);
  const cd = colorImg.data;
  const dd = dispImg.data;

  for (let i = 0; i < topo.length; i += 4) {
    const elev = topo[i] / 255;
    const wl = luminance(water[i], water[i + 1], water[i + 2]);
    const isOcean = bright ? wl > mid : wl < mid;

    let r: number;
    let g: number;
    let b: number;
    let disp: number;
    if (isOcean) {
      [r, g, b] = oceanColor(elev); // subtle depth variation, stays dark
      disp = 0; // flat seas
    } else {
      [r, g, b] = landColor(elev);
      disp = topo[i]; // keep land relief
    }
    cd[i] = r;
    cd[i + 1] = g;
    cd[i + 2] = b;
    cd[i + 3] = 255;
    dd[i] = disp;
    dd[i + 1] = disp;
    dd[i + 2] = disp;
    dd[i + 3] = 255;
  }

  colorCtx.putImageData(colorImg, 0, 0);
  dispCtx.putImageData(dispImg, 0, 0);
  return { colorCanvas, dispCanvas };
}

/**
 * Recolour a grayscale heightmap image into a hypsometric colour map on a
 * canvas (browser-only — uses the DOM). The red channel is read as elevation.
 * Returns the canvas so the caller can wrap it in a THREE.CanvasTexture.
 */
export function buildHypsometricCanvas(
  img: HTMLImageElement,
  maxWidth = 2048,
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = srcW > maxWidth ? maxWidth / srcW : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const elevation = data[i] / 255; // grayscale → red channel
    const [r, g, b] = elevationColor(elevation);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    // alpha (data[i + 3]) left at 255
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
