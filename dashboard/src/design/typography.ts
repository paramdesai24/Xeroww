/** Semantic typography roles shared by UI and chart integrations. */

export const typography = {
  family: {
    display: "'Inter Tight', 'Inter', system-ui, sans-serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'IBM Plex Mono', 'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
  },
  role: {
    pageTitle: "type-page-title",
    sectionTitle: "type-section-title",
    cardTitle: "type-card-title",
    body: "type-body",
    control: "type-control",
    label: "type-label",
    meta: "type-meta",
    data: "type-data",
    metric: "type-metric",
  },
  chart: {
    family: "'IBM Plex Mono', Consolas, monospace",
    axisSize: 11,
    nodeTitleSize: 13,
    nodeDetailSize: 12,
  },
} as const;
