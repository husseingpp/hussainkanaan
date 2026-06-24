// Hypsometric (elevation-tinted) colouring derived purely from a grayscale
// heightmap — no photographic Earth imagery. Kept free of any `three` import so
// the colour ramp stays a pure, unit-testable function.

export type RGB = [number, number, number];

interface Stop {
  at: number; // 0..1 position along the ramp
  color: RGB;
}

// Anything at/below this normalized elevation is treated as ocean.
export const SEA_LEVEL = 0.03;

const OCEAN: Stop[] = [
  { at: 0, color: [8, 28, 68] }, // deep
  { at: 1, color: [22, 84, 150] }, // shallow / coast
];

const LAND: Stop[] = [
  { at: 0.0, color: [72, 118, 70] }, // coastal green
  { at: 0.12, color: [99, 150, 78] }, // lowland green
  { at: 0.3, color: [150, 158, 92] }, // tan
  { at: 0.5, color: [138, 110, 72] }, // brown
  { at: 0.72, color: [112, 92, 80] }, // dark rock
  { at: 0.88, color: [183, 178, 173] }, // bare rock / grey
  { at: 1.0, color: [255, 255, 255] }, // snow / peaks
];

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
  return sample(LAND, (t - SEA_LEVEL) / (1 - SEA_LEVEL));
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
