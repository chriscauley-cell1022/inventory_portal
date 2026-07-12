import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';

interface WarehouseData {
  warehouse: string;
  total_value: number;
}

interface InventoryByWarehouseProps {
  triggerRefresh: number;
}

const formatValue = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
      flex: 1,
      minHeight: 100,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}
  >
    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>{value}</div>
    {percentage && <div style={{ fontSize: 13, color: '#1976d2', fontWeight: 'bold' }}>{percentage}</div>}
  </div>
);

const InventoryByWarehouse: React.FC<InventoryByWarehouseProps> = ({ triggerRefresh }) => {
  const [data, setData] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [triggerRefresh]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getInventoryByWarehouse();
      setData(result.warehouses || []);
    } catch (err) {
      console.error('Error loading warehouse inventory:', err);
      setError('Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Loading warehouse inventory...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: '#d32f2f' }}>{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No warehouse data available</div>;
  }

  const totalValue = data.reduce((sum, item) => sum + item.total_value, 0);

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 15, fontSize: 16, fontWeight: 600 }}>
        On-Hand Inventory by Warehouse
      </h3>
      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        {data.map((warehouse) => (
          <MetricCard
            key={warehouse.warehouse}
            label={warehouse.warehouse}
            value={formatValue(warehouse.total_value)}
            percentage={totalValue > 0 ? `${((warehouse.total_value / totalValue) * 100).toFixed(1)}%` : '0%'}
          />
        ))}
        <MetricCard
          label="Total On Hand"
          value={formatValue(totalValue)}
        />
      </div>
    </div>
  );
};

export default InventoryByWarehouse;
