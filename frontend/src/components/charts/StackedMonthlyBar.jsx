import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CATEGORY_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from './chartTheme.js';
import { monthLabel } from '../../utils/aggregations.js';

export default function StackedMonthlyBar({ data = [], categories = [] }) {
  if (!data.length) return <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No data</div>;

  const formatted = data.map((d) => ({ ...d, label: monthLabel(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
        <Legend
          wrapperStyle={{
            fontSize: 12,
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#a7bccd',
          }}
        />
        {categories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={CATEGORY_COLORS[cat] ?? '#94a3b8'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
