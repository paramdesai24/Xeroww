/**
 * Xeroww Design Tokens — Typography
 *
 * Two type families:
 * - Inter (sans): editorial prose, labels, UI text
 * - JetBrains Mono: all financial data, prices, timestamps, codes
 *
 * Scale derived from an 11px base with 1.2 ratio.
 * All sizes in pixels — Xeroww is a precision tool.
 */

export const typography = {
  family: {
    sans: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },

  size: {
    label:   9,    // ALL CAPS metadata labels
    caption: 10,   // Secondary text, badges
    body:    11,   // Default reading size
    data:    12,   // Data values
    value:   14,   // Key numbers (prices, counts)
    heading: 16,   // Section headings
  },

  weight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
  },

  tracking: {
    label:   "0.08em",  // UPPERCASE LABELS
    wide:    "0.05em",  // Module names, badges
    normal:  "0.02em",  // Body text
    tight:   "0em",     // Data values
  },

  leading: {
    compact: 1.3,
    default: 1.5,
    relaxed: 1.7,
  },
} as const;
