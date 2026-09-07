/**
 * Xeroww Design Tokens — Spacing & Motion
 *
 * Spacing: 4px base unit. Information density is a virtue.
 * Motion: Maximum 180ms. No bounce, no glow, no celebration.
 */

export const spacing = {
  // Base unit multiples
  0.5: 2,   // px
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  8:   32,
  10:  40,
  12:  48,
} as const;

export const motion = {
  duration: {
    fast:  "100ms",
    base:  "160ms",
    slow:  "180ms",
  },
  ease: {
    default: "cubic-bezier(0.16, 1, 0.3, 1)",
    linear:  "linear",
  },
  // Standard transition shorthand for CSS
  transitions: {
    base:  "color 160ms cubic-bezier(0.16,1,0.3,1), background-color 160ms cubic-bezier(0.16,1,0.3,1), border-color 160ms cubic-bezier(0.16,1,0.3,1)",
    fast:  "color 100ms cubic-bezier(0.16,1,0.3,1), background-color 100ms cubic-bezier(0.16,1,0.3,1)",
    opacity: "opacity 160ms cubic-bezier(0.16,1,0.3,1)",
  },
} as const;
