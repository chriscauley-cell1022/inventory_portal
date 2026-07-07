import React from 'react';

interface SummaryData {
  date: string;
  total_po_spend: number;
  total_po_quantity: number;
  total_qty_on_order: number;
  total_qty_in_transit: number;
  total_qty_on_hand: number;
  total_qty_called_off: number;
  wow_spend_change: number;
  wow_spend_pct_change: number;
  wow_quantity_change: number;
  wow_quantity_pct_change: number;
  mom_spend_change: number;
  mom_spend_pct_change: number;
  mom_quantity_change: number;
  mom_quantity_pct_change: number;
}

interface InventorySummaryProps {
  data: SummaryData | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

const formatPercent = (value: number) => {
  if (value === null || value === undefined) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  change?: string;
}> = ({ label, value, change }) => (
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
    {change && (
      <div
        style={{
          fontSize: 12,
          color: change.startsWith('+') ? '#4caf50' : '#f44336',
        }}
      >
        {change}
      </div>
    )}
  </div>
);

const InventorySummary: React.FC<InventorySummaryProps> = ({ data }) => {
  if (!data) return <div>No data available</div>;

  return (
    <div>
      <h2>Inventory Summary - {data.date}</h2>

      <h3>Current Inventory Levels</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
        <MetricCard
          label="Total PO Spend"
          value={formatCurrency(data.total_po_spend)}
        />
        <MetricCard label="Total PO Quantity" value={data.total_po_quantity.toLocaleString()} />
        <MetricCard label="On Order" value={data.total_qty_on_order.toLocaleString()} />
        <MetricCard label="In Transit" value={data.total_qty_in_transit.toLocaleString()} />
        <MetricCard label="On Hand" value={data.total_qty_on_hand.toLocaleString()} />
        <MetricCard label="Called Off" value={data.total_qty_called_off.toLocaleString()} />
      </div>

      <h3>Week-over-Week Growth</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
        <MetricCard
          label="PO Spend Change"
          value={formatCurrency(data.wow_spend_change || 0)}
          change={formatPercent(data.wow_spend_pct_change)}
        />
        <MetricCard
          label="PO Quantity Change"
          value={(data.wow_quantity_change || 0).toLocaleString()}
          change={formatPercent(data.wow_quantity_pct_change)}
        />
      </div>

      <h3>Month-over-Month Growth</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <MetricCard
          label="PO Spend Change"
          value={formatCurrency(data.mom_spend_change || 0)}
          change={formatPercent(data.mom_spend_pct_change)}
        />
        <MetricCard
          label="PO Quantity Change"
          value={(data.mom_quantity_change || 0).toLocaleString()}
          change={formatPercent(data.mom_quantity_pct_change)}
        />
      </div>
    </div>
  );
};

export default InventorySummary;
