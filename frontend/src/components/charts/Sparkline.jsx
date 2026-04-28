import { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data = [], color = '#2dd4bf', height = 40 }) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `spark-fill-${uid}`;

  // Convert hex color to a low-opacity fill by using it with opacity
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="total"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
