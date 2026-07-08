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

interface AggregatedPart {
  part_number: string;
  part_description: string;
  qty_on_order: number;
  qty_in_transit: number;
  qty_on_hand: number;
  total_amount: number;
  po_count: number;
}

interface SupplierAnalysisProps {
  suppliers: Supplier[];
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

const calculateAvailableSpend = (supplier: Supplier): number => {
  const qty = (supplier.total_qty_on_order || 0) + (supplier.total_qty_in_transit || 0) + (supplier.total_qty_on_hand || 0);
  return supplier.total_po_quantity && supplier.total_po_quantity > 0
    ? (qty / supplier.total_po_quantity) * (supplier.total_po_spend || 0)
    : 0;
};

const getSortedSuppliers = (
  suppliers: Supplier[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc'
): Supplier[] => {
  const sorted = [...suppliers];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortColumn) {
      case 'supplier':
        aVal = (a.supplier || '').toLowerCase();
        bVal = (b.supplier || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'po_spend':
        aVal = calculateAvailableSpend(a);
        bVal = calculateAvailableSpend(b);
        break;
      case 'wow_spend_change':
        aVal = a.wow_spend_change || 0;
        bVal = b.wow_spend_change || 0;
        break;
      case 'wow_spend_pct_change':
        aVal = a.wow_spend_pct_change || 0;
        bVal = b.wow_spend_pct_change || 0;
        break;
      case 'total_qty_on_order':
        aVal = a.total_qty_on_order || 0;
        bVal = b.total_qty_on_order || 0;
        break;
      case 'total_qty_in_transit':
        aVal = a.total_qty_in_transit || 0;
        bVal = b.total_qty_in_transit || 0;
        break;
      case 'total_qty_on_hand':
        aVal = a.total_qty_on_hand || 0;
        bVal = b.total_qty_on_hand || 0;
        break;
      case 'total_po_quantity':
        aVal = a.total_po_quantity || 0;
        bVal = b.total_po_quantity || 0;
        break;
      case 'wow_qty_change':
        aVal = a.wow_qty_change || 0;
        bVal = b.wow_qty_change || 0;
        break;
      case 'wow_qty_pct_change':
        aVal = a.wow_qty_pct_change || 0;
        bVal = b.wow_qty_pct_change || 0;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });

  return sorted;
};

const SupplierAnalysis: React.FC<SupplierAnalysisProps> = ({ suppliers }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [parts, setParts] = useState<AggregatedPart[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('po_spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleHeaderClick = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleSupplierClick = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingParts(true);
    try {
      const partsData: Part[] = await apiClient.getSupplierParts(supplier.supplier);

      // Filter to only parts with qty > 0 and aggregate
      const aggregated: { [key: string]: AggregatedPart } = {};

      partsData.forEach(part => {
        const qty = (part.qty_on_order || 0) + (part.qty_in_transit || 0) + (part.qty_on_hand || 0);
        if (qty > 0) {
          const key = part.part_number || 'Unknown';
          if (aggregated[key]) {
            aggregated[key].qty_on_order += part.qty_on_order || 0;
            aggregated[key].qty_in_transit += part.qty_in_transit || 0;
            aggregated[key].qty_on_hand += part.qty_on_hand || 0;
            aggregated[key].total_amount += part.total_po_amount || 0;
            aggregated[key].po_count += 1;
          } else {
            aggregated[key] = {
              part_number: part.part_number || 'Unknown',
              part_description: part.part_description || '',
              qty_on_order: part.qty_on_order || 0,
              qty_in_transit: part.qty_in_transit || 0,
              qty_on_hand: part.qty_on_hand || 0,
              total_amount: part.total_po_amount || 0,
              po_count: 1,
            };
          }
        }
      });

      setParts(Object.values(aggregated).sort((a, b) => b.total_amount - a.total_amount));
    } catch (err) {
      console.error('Error loading parts:', err);
    } finally {
      setLoadingParts(false);
    }
  };

  if (!suppliers || suppliers.length === 0) {
    return <div>No supplier data available</div>;
  }

  // Chart data with WoW labels
  const chartData = suppliers.map(s => ({
    ...s,
    wowLabel: `${s.wow_spend_pct_change ? (s.wow_spend_pct_change > 0 ? '+' : '') + s.wow_spend_pct_change.toFixed(1) + '%' : 'N/A'}`
  }));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>Supplier Analysis</h2>

      <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '110px' }} onClick={() => handleHeaderClick('supplier')}>
                Supplier {sortColumn === 'supplier' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '110px' }} onClick={() => handleHeaderClick('po_spend')}>
                PO Spend (€) {sortColumn === 'po_spend' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => handleHeaderClick('wow_spend_change')}>
                Δ from prior week (€) {sortColumn === 'wow_spend_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => handleHeaderClick('wow_spend_pct_change')}>
                % Δ from prior week {sortColumn === 'wow_spend_pct_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('total_qty_on_order')}>
                On Order {sortColumn === 'total_qty_on_order' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('total_qty_in_transit')}>
                In Transit {sortColumn === 'total_qty_in_transit' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('total_qty_on_hand')}>
                On Hand {sortColumn === 'total_qty_on_hand' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => handleHeaderClick('total_po_quantity')}>
                Total Quantity {sortColumn === 'total_po_quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('wow_qty_change')}>
                Δ from prior week {sortColumn === 'wow_qty_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => handleHeaderClick('wow_qty_pct_change')}>
                % Δ from prior week {sortColumn === 'wow_qty_pct_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {getSortedSuppliers(suppliers, sortColumn, sortDirection).map((s, idx) => (
              <tr
                key={idx}
                style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', cursor: 'pointer' }}
                onClick={() => handleSupplierClick(s)}
              >
                <td style={{ padding: 12, borderBottom: '1px solid #eee', color: '#1976d2', textDecoration: 'underline', textAlign: 'center', fontSize: 11 }}>
                  {s.supplier}
                </td>
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {formatCurrency(calculateAvailableSpend(s))}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_spend_change || 0) > 0 ? '#4caf50' : (s.wow_spend_change || 0) < 0 ? '#f44336' : '#000',
                    fontSize: 11,
                  }}
                >
                  {formatCurrency(s.wow_spend_change || 0)}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_spend_pct_change || 0) > 0 ? '#4caf50' : (s.wow_spend_pct_change || 0) < 0 ? '#f44336' : '#000',
                    fontSize: 11,
                  }}
                >
                  {s.wow_spend_pct_change ? `${s.wow_spend_pct_change > 0 ? '+' : ''}${s.wow_spend_pct_change.toFixed(1)}%` : 'N/A'}
                </td>
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {formatNumber(s.total_qty_on_order)}
                </td>
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {formatNumber(s.total_qty_in_transit)}
                </td>
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {formatNumber(s.total_qty_on_hand)}
                </td>
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {formatNumber((s.total_qty_on_order || 0) + (s.total_qty_in_transit || 0) + (s.total_qty_on_hand || 0))}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_qty_change || 0) > 0 ? '#4caf50' : (s.wow_qty_change || 0) < 0 ? '#f44336' : '#000',
                    fontSize: 11,
                  }}
                >
                  {formatNumber(s.wow_qty_change || 0)}
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    borderBottom: '1px solid #eee',
                    color: (s.wow_qty_pct_change || 0) > 0 ? '#4caf50' : (s.wow_qty_pct_change || 0) < 0 ? '#f44336' : '#000',
                    fontSize: 11,
                  }}
                >
                  {s.wow_qty_pct_change ? `${s.wow_qty_pct_change > 0 ? '+' : ''}${s.wow_qty_pct_change.toFixed(1)}%` : 'N/A'}
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                        Total Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11 }}>
                          {p.part_number}
                        </td>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11 }}>
                          {p.part_description}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_on_order)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_in_transit)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_on_hand)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {formatCurrency(p.total_amount)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #eee' }}>
                          {p.po_count}
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
