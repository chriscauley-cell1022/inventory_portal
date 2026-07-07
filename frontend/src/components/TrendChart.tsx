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
  <div style={{ width: '100%', height: 400, marginBottom: 40 }}>
    <h3>{title}</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 60, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip />
        <Legend />
        {lines.map(line => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default TrendChart;
