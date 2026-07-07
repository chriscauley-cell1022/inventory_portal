import React from 'react';

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
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
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

  // Total inventory value
  const totalInventoryValue = (data.spend_on_order || 0) + (data.spend_in_transit || 0) + (data.spend_on_hand || 0);

  return (
    <div>
      <h2>Inventory Summary - {data.date}</h2>

      <h3>Inventory Value Breakdown</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
        <MetricCard
          label="Total Inventory Value"
          value={formatCurrency(totalInventoryValue)}
        />
        <MetricCard
          label={`On Order`}
          value={formatCurrency(data.spend_on_order || 0)}
        />
        <MetricCard
          label={`In Transit`}
          value={formatCurrency(data.spend_in_transit || 0)}
        />
        <MetricCard
          label={`On Hand`}
          value={formatCurrency(data.spend_on_hand || 0)}
        />
      </div>
    </div>
  );
};

export default InventorySummary;
