import { useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from './chartTheme.js';
import { monthLabel } from '../../utils/aggregations.js';

export default function MonthlyTrendChart({ data = [] }) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `trend-fill-${uid}`;

  if (!data.length) return <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No data</div>;

  const formatted = data.map((d) => ({ ...d, label: monthLabel(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(45,212,191,0.3)" />
            <stop offset="100%" stopColor="rgba(45,212,191,0)" />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE.tick}
          axisLine={AXIS_STYLE.axisLine}
          tickLine={AXIS_STYLE.tickLine}
        />
        <YAxis
          tick={AXIS_STYLE.tick}
          axisLine={AXIS_STYLE.axisLine}
          tickLine={AXIS_STYLE.tickLine}
          width={60}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE.contentStyle}
          labelStyle={TOOLTIP_STYLE.labelStyle}
          cursor={TOOLTIP_STYLE.cursor}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#2dd4bf"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
