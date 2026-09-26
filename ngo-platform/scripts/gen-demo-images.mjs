// Generates the original placeholder images in public/demo (used only by supabase/demo.sql).
// Run: node scripts/gen-demo-images.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const W = 1600, H = 1000;
// Each scene: sky gradient, sun, layered hills, optional trees / rows / sea.
const scenes = {
  "hero-1": { sky: ["#2b7a9e", "#f2c57c"], sun: "#ffe7a8", hills: ["#6d9c5a", "#3f7a47", "#1f6f4a"], trees: true },
  "hero-2": { sky: ["#c98a2b", "#f6dfb3"], sun: "#fff1cf", hills: ["#b9894a", "#8a6a3a", "#5c4a2a"], rows: true },
  "act-1": { sky: ["#8cc6d9", "#e9f4e5"], sun: "#fff6d5", hills: ["#9cc27a", "#6fa05a", "#3f7a47"], rows: true },
  "act-2": { sky: ["#5aa2c2", "#d7ecf2"], sun: "#ffffff", hills: ["#7fb3c8", "#4f8fae", "#2b6a8a"], sea: true },
  "act-3": { sky: ["#f3b67a", "#fbe3c8"], sun: "#fff4dc", hills: ["#a7c08a", "#7c9e62", "#4e7a45"], trees: true },
  "act-4": { sky: ["#9fb7d8", "#eef2f8"], sun: "#ffffff", hills: ["#c9d6c0", "#96b38c", "#5f8a5a"], trees: true },
  "act-5": { sky: ["#e7a36b", "#f9dcc0"], sun: "#fff0d8", hills: ["#c7a26a", "#a07c45", "#6e5530"], rows: true },
  "act-6": { sky: ["#6fb0a0", "#e2f2ec"], sun: "#fbfff9", hills: ["#8fc0a4", "#5c9a7e", "#2f6f55"], sea: true },
  "evt-1": { sky: ["#4a5f8a", "#c9d3e8"], sun: "#f7f2e0", hills: ["#7e8fb0", "#56698f", "#34466b"], trees: false },
  "evt-2": { sky: ["#7a4f8a", "#e8d3ea"], sun: "#fff3e6", hills: ["#a784b0", "#7d5f8f", "#4f3b63"], trees: false },
};
const hill = (y, amp, color, phase) => {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W; x += 40) d += ` L${x} ${(y + Math.sin(x / 260 + phase) * amp + Math.sin(x / 90 + phase * 2) * amp * 0.15).toFixed(1)}`;
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
};
for (const [name, s] of Object.entries(scenes)) {
  const seed = name.length * 7;
  let extra = "";
  if (s.trees) for (let i = 0; i < 9; i++) {
    const x = 120 + i * 170 + (i % 3) * 20, y = 700 + (i % 2) * 60, r = 38 + (i % 3) * 10;
    extra += `<rect x="${x - 5}" y="${y}" width="10" height="${r + 20}" fill="#3b2e1e" opacity=".7"/><circle cx="${x}" cy="${y}" r="${r}" fill="#24553a" opacity=".85"/>`;
  }
  if (s.rows) for (let i = 0; i < 7; i++) extra += `<path d="M${-200 + i * 60} ${H} Q ${W / 2} ${720 + i * 30} ${W + 200 - i * 60} ${H}" stroke="#2f4a22" stroke-opacity=".25" stroke-width="6" fill="none"/>`;
  if (s.sea) extra += `<rect x="0" y="760" width="${W}" height="240" fill="#2b6a8a" opacity=".55"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${1100 + (seed % 5) * 60}" cy="${280 + (seed % 3) * 30}" r="110" fill="${s.sun}" opacity=".9"/>
    ${hill(560, 60, s.hills[0], seed)}${hill(660, 50, s.hills[1], seed + 1)}${hill(780, 40, s.hills[2], seed + 2)}${extra}
  </svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 72 }).toFile(`public/demo/${name}.webp`);
}
console.log("done");
