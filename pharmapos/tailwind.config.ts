import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0d9488", // teal-600
          dark: "#0f766e",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
