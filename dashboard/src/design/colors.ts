/**
 * Xeroww Design Tokens — Colors
 * Single source of truth for all color decisions.
 * Mirrors the CSS custom properties in index.css.
 *
 * Rule: Only import this in components that need
 * programmatic access (e.g. chart color configs).
 * Otherwise, use Tailwind classes or CSS variables.
 */

export const colors = {
  // Surface stack
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
  accent:       "var(--accent)",
  accentSubtle: "var(--accent-subtle)",
  accentBorder: "var(--accent-border)",

  // Semantic — desaturated to fit graphite world
  positive:        "var(--positive)",
  positiveSubtle:  "var(--positive-subtle)",
  positiveBorder:  "var(--positive-border)",

  negative:        "var(--negative)",
  negativeSubtle:  "var(--negative-subtle)",
  negativeBorder:  "var(--negative-border)",

  warning:         "var(--warning)",
  warningSubtle:   "var(--warning-subtle)",
  warningBorder:   "var(--warning-border)",

  neutral:         "var(--neutral)",
  neutralSubtle:   "var(--neutral-subtle)",
} as const;

/**
 * Raw hex values for use in canvas/SVG/chart contexts
 * where CSS variables cannot be applied.
 */
export const rawColors = {
  positive:   "#5C9E6E",
  negative:   "#C05656",
  warning:    "#9E7E3F",
  accent:     "#5B7FA6",
  textPrimary: "#E8E8E3",
  textSecondary: "#9C9C95",
  borderSubtle: "#242422",
  surfaceBase:  "#0F0F0E",
  surfaceRaised: "#161614",
} as const;
