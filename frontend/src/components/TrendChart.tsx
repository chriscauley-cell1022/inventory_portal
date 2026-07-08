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
  Label,
} from 'recharts';

interface TrendChartProps {
  data: any[];
  title: string;
  lines: Array<{ dataKey: string; name: string; color: string }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const formatDateEuropean = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

const TrendChart: React.FC<TrendChartProps> = ({ data, title, lines, xAxisLabel = 'Date', yAxisLabel = 'Value' }) => (
  <div style={{ width: '100%', marginBottom: 0 }}>
    <h3 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>{title}</h3>
    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, marginBottom: 12 }}>
      {lines.map(line => (
        <div key={line.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 2, backgroundColor: line.color }} />
          <span>{line.name}</span>
        </div>
      ))}
    </div>
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 65, left: 65, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 11 }}
            tickFormatter={(date) => formatDateEuropean(date)}
          >
            <Label value={xAxisLabel} position="insideBottomRight" offset={5} style={{ fontSize: 10, fontWeight: 'bold' }} />
          </XAxis>
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
          >
            <Label value={yAxisLabel} angle={-90} position="center" offset={5} style={{ fontSize: 10, fontWeight: 'bold' }} />
          </YAxis>
          <Tooltip
            formatter={(value: any) => {
              if (typeof value === 'number') {
                return `€${new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value)}`;
              }
              return value;
            }}
            labelFormatter={(label) => {
              const dataPoint = data.find(d => d.date === label);
              const formattedDate = formatDateEuropean(label);
              if (dataPoint && dataPoint.wow_pct !== undefined && dataPoint.wow_pct !== null) {
                return `${formattedDate} (${dataPoint.wow_pct > 0 ? '+' : ''}${dataPoint.wow_pct.toFixed(1)}% WoW)`;
              }
              return formattedDate;
            }}
          />
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
  </div>
);

export default TrendChart;
