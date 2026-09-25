/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "Cascadia Code", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        "page": ["var(--type-page-size)", { lineHeight: "var(--type-page-leading)" }],
        "section": ["var(--type-section-size)", { lineHeight: "var(--type-section-leading)" }],
        "card": ["var(--type-card-size)", { lineHeight: "var(--type-card-leading)" }],
        "body": ["var(--type-body-size)", { lineHeight: "var(--type-body-leading)" }],
        "control": ["var(--type-control-size)", { lineHeight: "var(--type-control-leading)" }],
        "label": ["var(--type-label-size)", { lineHeight: "var(--type-label-leading)" }],
        "data": ["var(--type-data-size)", { lineHeight: "var(--type-data-leading)" }],
        "metric": ["var(--type-metric-size)", { lineHeight: "var(--type-metric-leading)" }],
      },
      colors: {
        canvas: "var(--canvas)",
        surface: {
          base:     "var(--surface-base)",
          DEFAULT:  "var(--surface)",
          raised:   "var(--surface-raised)",
          elevated: "var(--surface-elevated)",
          overlay:  "var(--surface-overlay)",
          inset:    "var(--surface-inset)",
        },
        border: {
          subtle:   "var(--border-subtle)",
          default:  "var(--border-default)",
          strong:   "var(--border-strong)",
          focus:    "var(--border-focus)",
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
