import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev-server port and prefers not to clear the terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  // Produce sourcemaps in dev builds; let Tauri control the rest.
  build: {
    target: "es2021",
    sourcemap: true,
  },
});
