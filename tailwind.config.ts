import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05060a",
          900: "#0a0c13",
          800: "#11141d",
          700: "#1a1e2a",
        },
        glow: {
          violet: "#8a5cff",
          pink: "#ff4fd8",
          cyan: "#4fc3ff",
          amber: "#ffb454",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        "glow-inner": "inset 0 0 80px rgba(138, 92, 255, 0.35)",
        "glow-soft": "0 0 40px rgba(138, 92, 255, 0.35)",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
