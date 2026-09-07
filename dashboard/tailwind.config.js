/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
      colors: {
        // Graphite surface stack
        surface: {
          base:    "var(--surface-base)",
          raised:  "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          inset:   "var(--surface-inset)",
        },
        // Border stack
        border: {
          subtle:  "var(--border-subtle)",
          default: "var(--border-default)",
          strong:  "var(--border-strong)",
        },
        // Text hierarchy
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          disabled:  "var(--text-disabled)",
        },
        // Accent
        accent: {
          DEFAULT: "var(--accent)",
          subtle:  "var(--accent-subtle)",
          border:  "var(--accent-border)",
        },
        // Semantic
        positive: {
          DEFAULT: "var(--positive)",
          subtle:  "var(--positive-subtle)",
          border:  "var(--positive-border)",
        },
        negative: {
          DEFAULT: "var(--negative)",
          subtle:  "var(--negative-subtle)",
          border:  "var(--negative-border)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          subtle:  "var(--warning-subtle)",
          border:  "var(--warning-border)",
        },
      },
      transitionDuration: {
        "fast": "100ms",
        "base": "160ms",
        "slow": "180ms",
      },
      transitionTimingFunction: {
        "default": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
