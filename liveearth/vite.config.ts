import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset URLs relative so the SPA works both standalone
// (`npm run preview`) and when served from a sub-path on GitHub Pages
// (https://husseingpp.github.io/hussainkanaan/liveearth/).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
