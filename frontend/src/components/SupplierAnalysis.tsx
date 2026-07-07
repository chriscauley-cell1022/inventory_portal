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
} from 'recharts';
import { apiClient } from '../api';

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
  wow_spend_change: number;
  wow_spend_pct_change: number | null;
  wow_qty_change: number;
  wow_qty_pct_change: number | null;
}

interface Part {
  part_number: string;
  part_description: string;
  po_number: string;
  qty_on_order: number;
  qty_in_transit: number;
  qty_on_hand: number;
  total_po_amount: number;
  po_quantity: number;
}

interface SupplierAnalysisProps {
  suppliers: Supplier[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

const SupplierAnalysis: React.FC<SupplierAnalysisProps> = ({ suppliers }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  const handleSupplierClick = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingParts(true);
    try {
      const partsData = await apiClient.getSupplierParts(supplier.supplier);
      setParts(partsData);
    } catch (err) {
      console.error('Error loading parts:', err);
    } finally {
      setLoadingParts(false);
    }
  };

  if (!suppliers || suppliers.length === 0) {
    return <div>No supplier data available</div>;
  }

  return (
    <div>
      <h2>Supplier Analysis</h2>

      <h3>WoW Spend Change by Supplier</h3>
      <div style={{ width: '100%', height: 400, marginBottom: 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={suppliers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="supplier"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis label={{ value: 'Spend Change (€)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
            <Legend />
            <Bar dataKey="wow_spend_change" fill="#8884d8" name="WoW Spend Change (€)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3>WoW Quantity Change by Supplier</h3>
      <div style={{ width: '100%', height: 400, marginBottom: 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={suppliers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="supplier"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis label={{ value: 'Quantity Change', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="wow_qty_change" fill="#82ca9d" name="WoW Quantity Change" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3>Current Supplier Metrics</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer' }}>
                Supplier (click to drill down)
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                PO Spend (€)
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Spend WoW Change (€)
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Spend WoW %
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Quantity
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Qty WoW Change
              </th>
              <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Qty WoW %
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
                Delivery Variance (days)
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, idx) => (
              <tr
                key={idx}
                style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', cursor: 'pointer' }}
                onClick={() => handleSupplierClick(s)}
              >
                <td style={{ padding: 12, borderBottom: '1px solid #eee', color: '#1976d2', textDecoration: 'underline' }}>
                  {s.supplier}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {formatCurrency(s.total_po_spend)}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'right',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_spend_change || 0) > 0 ? '#4caf50' : '#f44336',
                  }}
                >
                  {formatCurrency(s.wow_spend_change || 0)}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'right',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_spend_pct_change || 0) > 0 ? '#4caf50' : '#f44336',
                  }}
                >
                  {s.wow_spend_pct_change ? `${s.wow_spend_pct_change > 0 ? '+' : ''}${s.wow_spend_pct_change.toFixed(1)}%` : 'N/A'}
                </td>
                <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  {s.total_po_quantity.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'right',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_qty_change || 0) > 0 ? '#4caf50' : '#f44336',
                  }}
                >
                  {s.wow_qty_change}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'right',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_qty_pct_change || 0) > 0 ? '#4caf50' : '#f44336',
                  }}
                >
                  {s.wow_qty_pct_change ? `${s.wow_qty_pct_change > 0 ? '+' : ''}${s.wow_qty_pct_change.toFixed(1)}%` : 'N/A'}
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
                  {s.avg_delivery_variance_days.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSupplier && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setSelectedSupplier(null);
            setParts([]);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 8,
              padding: 30,
              maxWidth: '90%',
              maxHeight: '90%',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>{selectedSupplier.supplier} - Part Numbers</h2>
              <button
                onClick={() => {
                  setSelectedSupplier(null);
                  setParts([]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            {loadingParts ? (
              <div>Loading parts...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                        Part Number
                      </th>
                      <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                        Description
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
                        Total Amount (€)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 12 }}>
                          {p.part_number}
                        </td>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 12 }}>
                          {p.part_description}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {p.qty_on_order.toLocaleString()}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {p.qty_in_transit.toLocaleString()}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {p.qty_on_hand.toLocaleString()}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {formatCurrency(p.total_po_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierAnalysis;
