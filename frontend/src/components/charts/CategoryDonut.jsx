import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORY_COLORS, TOOLTIP_STYLE } from './chartTheme.js';

function formatCurrency(value) {
  return `€${value.toFixed(2)}`;
}

export default function CategoryDonut({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        color: 'var(--muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
      }}>
        No data
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={CATEGORY_COLORS[entry.category] ?? '#94a3b8'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
            formatter={(value, name) => [formatCurrency(value), name]}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: '0.75rem 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}>
        {data.map((entry) => (
          <li key={entry.category} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-2)',
          }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: CATEGORY_COLORS[entry.category] ?? '#94a3b8',
              flexShrink: 0,
            }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{entry.category}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {formatCurrency(entry.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
