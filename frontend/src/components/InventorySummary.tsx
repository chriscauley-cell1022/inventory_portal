import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface SummaryData {
  date: string;
  total_po_spend: number;
  total_po_quantity: number;
  open_po_spend: number;
  total_qty_on_order: number;
  total_qty_in_transit: number;
  total_qty_on_hand: number;
  spend_on_order: number;
  spend_in_transit: number;
  spend_on_hand: number;
}

interface InventorySummaryProps {
  data: SummaryData | null;
  suppliers?: any[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

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

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  percentage?: string;
}> = ({ label, value, percentage }) => (
  <div
    style={{
      padding: 20,
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      minWidth: 200,
    }}
  >
    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>{value}</div>
    {percentage && <div style={{ fontSize: 13, color: '#1976d2', fontWeight: 'bold' }}>{percentage}</div>}
  </div>
);

const InventorySummary: React.FC<InventorySummaryProps> = ({ data, suppliers }) => {
  if (!data) return <div>No data available</div>;

  // Total inventory value
  const totalInventoryValue = (data.spend_on_order || 0) + (data.spend_in_transit || 0) + (data.spend_on_hand || 0);

  // Calculate percentages
  const onOrderPct = totalInventoryValue > 0 ? ((data.spend_on_order || 0) / totalInventoryValue * 100).toFixed(1) : '0.0';
  const inTransitPct = totalInventoryValue > 0 ? ((data.spend_in_transit || 0) / totalInventoryValue * 100).toFixed(1) : '0.0';
  const onHandPct = totalInventoryValue > 0 ? ((data.spend_on_hand || 0) / totalInventoryValue * 100).toFixed(1) : '0.0';

  // Prepare supplier pie chart data
  const supplierPieData = suppliers ? suppliers.map(s => ({
    name: s.supplier,
    value: s.total_po_spend || 0,
  })) : [];

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd63d', '#d084d0', '#ff9896', '#98df8a'];

  // Prepare supplier bar chart data with only available inventory (on order, in transit, on hand)
  const supplierBarData = suppliers
    ? suppliers
        .map(s => {
          const totalAvailableQty = (s.total_qty_on_order || 0) + (s.total_qty_in_transit || 0) + (s.total_qty_on_hand || 0);
          const spendPerUnit = s.total_po_quantity && s.total_po_quantity > 0
            ? (s.total_po_spend || 0) / s.total_po_quantity
            : 0;
          const value = totalAvailableQty * spendPerUnit;
          return {
            name: s.supplier,
            value: value,
            percentage: 0,
            label: '',
          };
        })
        .filter(s => s.value > 0)
        .map((s, _, arr) => {
          const total = arr.reduce((sum, item) => sum + item.value, 0);
          return {
            ...s,
            percentage: total > 0 ? (s.value / total * 100) : 0,
          };
        })
        .map(s => ({
          ...s,
          label: `${formatCurrency(s.value)}\n${s.percentage.toFixed(1)}%`,
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const CustomLabel = (props: any) => {
    const { x, y, width, value } = props;
    const data = supplierBarData.find(d => d.value === value);
    if (!data) return null;
    const lines = data.label.split('\n');
    return (
      <g>
        <text x={x + width / 2} y={y - 25} textAnchor="middle" fill="#000" fontSize={9}>
          {lines[0]}
        </text>
        <text x={x + width / 2} y={y - 15} textAnchor="middle" fill="#000" fontSize={9}>
          {lines[1]}
        </text>
      </g>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div>
          <MetricCard
            label="Total Inventory Value"
            value={formatCurrency(totalInventoryValue)}
          />
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
            <MetricCard
              label="On Order"
              value={formatCurrency(data.spend_on_order || 0)}
              percentage={`${onOrderPct}%`}
            />
            <MetricCard
              label="In Transit"
              value={formatCurrency(data.spend_in_transit || 0)}
              percentage={`${inTransitPct}%`}
            />
            <MetricCard
              label="On Hand"
              value={formatCurrency(data.spend_on_hand || 0)}
              percentage={`${onHandPct}%`}
            />
          </div>
        </div>
      </div>

      {supplierBarData.length > 0 && (
        <div style={{ marginBottom: 20, maxWidth: 1200, margin: '20px auto 0' }}>
          <h3 style={{ textAlign: 'center' }}>Open PO Spend by Supplier</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={supplierBarData} margin={{ top: 20, right: 85, left: 65, bottom: 0 }} maxBarSize={60}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                label={{ value: 'Spend (€)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fontWeight: 'bold' } }}
                tick={{ fontSize: 11 }}
                width={80}
                tickFormatter={(value) =>
                  new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    compactDisplay: 'short',
                    maximumFractionDigits: 0,
                  }).format(value)
                }
              />
              <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]} label={<CustomLabel />}>
                {supplierBarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default InventorySummary;
