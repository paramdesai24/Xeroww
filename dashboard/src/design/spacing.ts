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
    fast:  "180ms",
    base:  "180ms",
    slow:  "180ms",
  },
  ease: {
    default: "cubic-bezier(.2,.8,.2,1)",
    linear:  "linear",
  },
  // Standard transition shorthand for CSS
  transitions: {
    base:  "color 180ms cubic-bezier(.2,.8,.2,1), background-color 180ms cubic-bezier(.2,.8,.2,1), border-color 180ms cubic-bezier(.2,.8,.2,1)",
    fast:  "color 180ms cubic-bezier(.2,.8,.2,1), background-color 180ms cubic-bezier(.2,.8,.2,1)",
    opacity: "opacity 180ms cubic-bezier(.2,.8,.2,1)",
  },
} as const;
