import React from 'react';

interface SummaryData {
  date: string;
  total_po_spend: number;
  total_po_quantity: number;
  total_qty_on_order: number;
  total_qty_in_transit: number;
  total_qty_on_hand: number;
  wow_spend_change: number;
  wow_spend_pct_change: number;
  wow_quantity_change: number;
  wow_quantity_pct_change: number;
}

interface InventorySummaryProps {
  data: SummaryData | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
}> = ({ label, value }) => (
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
  </div>
);

const InventorySummary: React.FC<InventorySummaryProps> = ({ data }) => {
  if (!data) return <div>No data available</div>;

  // Calculate total inventory value (excluding called off)
  const totalInventorySpend =
    ((data.total_qty_on_order + data.total_qty_in_transit + data.total_qty_on_hand) / data.total_po_quantity) *
    data.total_po_spend;

  return (
    <div>
      <h2>Inventory Summary - {data.date}</h2>

      <h3>Current Inventory Levels (Active POs with Quantity &gt; 0)</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
        <MetricCard
          label="Total PO Spend"
          value={formatCurrency(data.total_po_spend)}
        />
        <MetricCard label="Total PO Quantity" value={formatNumber(data.total_po_quantity)} />
        <MetricCard label="On Order" value={formatNumber(data.total_qty_on_order)} />
        <MetricCard label="In Transit" value={formatNumber(data.total_qty_in_transit)} />
        <MetricCard label="On Hand" value={formatNumber(data.total_qty_on_hand)} />
      </div>

      <h3>Inventory Value Breakdown</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <MetricCard
          label={`On Order (${formatNumber(data.total_qty_on_order)} units)`}
          value={formatCurrency(
            (data.total_qty_on_order / data.total_po_quantity) * data.total_po_spend
          )}
        />
        <MetricCard
          label={`In Transit (${formatNumber(data.total_qty_in_transit)} units)`}
          value={formatCurrency(
            (data.total_qty_in_transit / data.total_po_quantity) * data.total_po_spend
          )}
        />
        <MetricCard
          label={`On Hand (${formatNumber(data.total_qty_on_hand)} units)`}
          value={formatCurrency(
            (data.total_qty_on_hand / data.total_po_quantity) * data.total_po_spend
          )}
        />
      </div>
    </div>
  );
};

export default InventorySummary;
