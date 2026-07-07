import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  data: any[];
  title: string;
  lines: Array<{ dataKey: string; name: string; color: string }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, title, lines, xAxisLabel = 'Date', yAxisLabel = 'Value' }) => (
  <div style={{ width: '100%', marginBottom: 50 }}>
    <h3>{title}</h3>
    <div style={{ width: '100%', height: 450 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 100, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={95}
            tickFormatter={(value) =>
              new Intl.NumberFormat('en-US', {
                notation: 'compact',
                compactDisplay: 'short',
                maximumFractionDigits: 0,
              }).format(value)
            }
          />
          <Tooltip
            formatter={(value: any) => {
              if (typeof value === 'number') {
                return new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value);
              }
              return value;
            }}
            labelFormatter={(label) => {
              const dataPoint = data.find(d => d.date === label);
              if (dataPoint && dataPoint.wow_pct !== undefined && dataPoint.wow_pct !== null) {
                return `${label} (${dataPoint.wow_pct > 0 ? '+' : ''}${dataPoint.wow_pct.toFixed(1)}% WoW)`;
              }
              return label;
            }}
          />
          <Legend wrapperStyle={{ paddingTop: 20 }} />
          {lines.map(line => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
      <div style={{ marginBottom: 5 }}>
        <strong>Y-Axis:</strong> {yAxisLabel}
      </div>
      <div>
        <strong>X-Axis:</strong> {xAxisLabel}
      </div>
    </div>
  </div>
);

export default TrendChart;
