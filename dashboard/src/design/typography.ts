/**
 * Xeroww Design Tokens — Typography
 *
 * Two type families:
 * - Inter (sans): editorial prose, labels, UI text
 * - IBM Plex Mono: financial data, prices, timestamps, codes
 *
 * Scale derived from a readable 13px interface base.
 * All sizes are in pixels because Xeroww is a precision tool.
 */

export const typography = {
  family: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'IBM Plex Mono', 'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
  },

  size: {
    label:   11,
    caption: 12,
    body:    13,
    data:    13,
    value:   15,
    heading: 17,
  },

  weight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
  },

  tracking: {
    label:   "0.04em",
    wide:    "0.025em",
    normal:  "0em",
    tight:   "-0.01em",
  },

  leading: {
    compact: 1.35,
    default: 1.5,
    relaxed: 1.6,
  },
} as const;
