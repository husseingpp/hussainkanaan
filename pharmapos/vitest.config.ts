import { defineConfig } from "vitest/config";

// The scanner detector and money helpers are pure logic — a Node environment is enough.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
