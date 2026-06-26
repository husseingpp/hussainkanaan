import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Descriptive wing palette — neutral, never pejorative.
        wing: {
          left: "#2563eb",   // blue
          center: "#6b7280", // gray
          right: "#dc2626",  // red
        },
      },
    },
  },
  plugins: [],
};

export default config;
