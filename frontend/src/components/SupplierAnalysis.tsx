import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

interface Supplier {
  supplier: string;
  total_po_spend: number;
  total_po_quantity: number;
  total_qty_on_order: number;
  total_qty_in_transit: number;
  total_qty_on_hand: number;
  total_qty_called_off: number;
  avg_delivery_variance_days: number;
  po_count: number;
}

interface SupplierAnalysisProps {
  suppliers: Supplier[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

const SupplierAnalysis: React.FC<SupplierAnalysisProps> = ({ suppliers }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  if (!suppliers || suppliers.length === 0) {
    return <div>No supplier data available</div>;
  }

  const topSuppliers = suppliers.slice(0, 10);

  const deliveryData = suppliers.map(s => ({
    supplier: s.supplier.replace('DWM - ', ''),
    variance: s.avg_delivery_variance_days || 0,
    po_count: s.po_count,
  }));

  return (
    <div>
      <h2>Supplier Analysis</h2>

      <h3>Top 10 Suppliers by PO Spend</h3>
      <div style={{ width: '100%', height: 400, marginBottom: 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topSuppliers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="supplier"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis yAxisId="left" label={{ value: 'PO Spend ($)', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Quantity', angle: 90, position: 'insideRight' }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="total_po_spend" fill="#8884d8" name="PO Spend ($)" />
            <Bar yAxisId="right" dataKey="total_po_quantity" fill="#82ca9d" name="PO Quantity" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3>Delivery Performance (Variance in Days)</h3>
      <div style={{ width: '100%', height: 400, marginBottom: 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="variance" name="Delivery Variance (days)" />
            <YAxis type="number" dataKey="po_count" name="Number of POs" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              name="Suppliers"
              data={deliveryData}
              fill="#8884d8"
              onClick={(data: any) => setSelectedSupplier(data.supplier)}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <h3>Supplier Details</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Supplier
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                PO Spend
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Quantity
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                On Order
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                In Transit
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                On Hand
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Avg Delivery Variance
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                PO Count
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{s.supplier}</td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {formatCurrency(s.total_po_spend)}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.total_po_quantity.toLocaleString()}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.total_qty_on_order.toLocaleString()}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.total_qty_in_transit.toLocaleString()}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.total_qty_on_hand.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'right',
                    borderBottom: '1px solid #eee',
                    color: (s.avg_delivery_variance_days || 0) > 0 ? '#f44336' : '#4caf50',
                    fontWeight: 'bold',
                  }}
                >
                  {(s.avg_delivery_variance_days || 0).toFixed(1)} days
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.po_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierAnalysis;
