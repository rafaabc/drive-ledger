export const CATEGORY_COLORS = {
  Fuel:        '#fbbf24',   // --warning / amber
  Maintenance: '#60a5fa',   // --info / blue
  Insurance:   '#a78bfa',   // violet
  Parking:     '#4ade80',   // --success / green
  Toll:        '#fb923c',   // orange
  Tax:         '#f87171',   // --danger / red
  Other:       '#94a3b8',   // slate
};

export const AXIS_STYLE = {
  tick: { fill: '#6f8aa3', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' },
  axisLine: { stroke: '#1f3149' },
  tickLine: { stroke: '#1f3149' },
};

export const GRID_STYLE = {
  stroke: '#1f3149',
  strokeDasharray: '3 3',
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f1b27',
    border: '1px solid #1f3149',
    borderRadius: '10px',
    color: '#e2ecf5',
    fontSize: 13,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  labelStyle: { color: '#a7bccd' },
  cursor: { fill: 'rgba(45,212,191,0.06)' },
};
