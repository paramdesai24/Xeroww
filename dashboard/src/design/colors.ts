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
  positive:        "#22C55E",
  negative:        "#EF4444",
  warning:         "#3B82F6",
  accent:          "#3B82F6",
  accentSecondary: "#3B82F6",
  textPrimary:     "#F7F8FA",
  textSecondary:   "#9AA4B2",
  textMuted:       "#687385",
  borderDefault:   "rgba(255,255,255,.06)",
  borderSubtle:    "rgba(255,255,255,.03)",
  surfaceBase:     "#050607",
  surface:         "#0C1015",
  surfaceElevated: "#11161D",
} as const;
