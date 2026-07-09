// Total Quantity fix: sum of on_order + in_transit + on_hand
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
  cfy_spend_pct_change: number | null;
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
      case 'po_spend_pct':
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
      case 'cfy_spend_pct_change':
        aVal = a.cfy_spend_pct_change || 0;
        bVal = b.cfy_spend_pct_change || 0;
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

interface PO {
  po_number: string;
  po_date: string;
  part_number: string;
  order_qty: number;
  total_amount: number;
  requested_del_date: string;
  confirmed_del_date: string;
  wh_receipt_date: string;
  status: string;
}

const SupplierAnalysis: React.FC<SupplierAnalysisProps> = ({ suppliers }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [parts, setParts] = useState<AggregatedPart[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('po_spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [partsSortColumn, setPartsSortColumn] = useState<string>('total_amount');
  const [partsSortDirection, setPartsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPart, setSelectedPart] = useState<AggregatedPart | null>(null);
  const [pos, setPos] = useState<PO[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSortColumn, setPoSortColumn] = useState<string>('po_number');
  const [poSortDirection, setPoSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleHeaderClick = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handlePartsHeaderClick = (column: string) => {
    if (partsSortColumn === column) {
      setPartsSortDirection(partsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPartsSortColumn(column);
      setPartsSortDirection('desc');
    }
  };

  const handlePoHeaderClick = (column: string) => {
    if (poSortColumn === column) {
      setPoSortDirection(poSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPoSortColumn(column);
      setPoSortDirection('asc');
    }
  };

  const getSortedParts = (partsToSort: AggregatedPart[]): AggregatedPart[] => {
    const sorted = [...partsToSort];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (partsSortColumn) {
        case 'part_number':
          aVal = (a.part_number || '').toLowerCase();
          bVal = (b.part_number || '').toLowerCase();
          return partsSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'part_description':
          aVal = (a.part_description || '').toLowerCase();
          bVal = (b.part_description || '').toLowerCase();
          return partsSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'qty_on_order':
          aVal = a.qty_on_order || 0;
          bVal = b.qty_on_order || 0;
          break;
        case 'qty_in_transit':
          aVal = a.qty_in_transit || 0;
          bVal = b.qty_in_transit || 0;
          break;
        case 'qty_on_hand':
          aVal = a.qty_on_hand || 0;
          bVal = b.qty_on_hand || 0;
          break;
        case 'total_amount':
          aVal = a.total_amount || 0;
          bVal = b.total_amount || 0;
          break;
        case 'po_count':
          aVal = a.po_count || 0;
          bVal = b.po_count || 0;
          break;
        case 'spend_pct':
          aVal = a.total_amount || 0;
          bVal = b.total_amount || 0;
          break;
        default:
          return 0;
      }

      if (partsSortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return sorted;
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

  const handlePartClick = async (part: AggregatedPart) => {
    setSelectedPart(part);
    setLoadingPOs(true);
    try {
      const posData: PO[] = await apiClient.getPartPOs(selectedSupplier!.supplier, part.part_number);
      setPos(posData);
    } catch (err) {
      console.error('Error loading POs:', err);
    } finally {
      setLoadingPOs(false);
    }
  };

  const calculateDaysEarlyLate = (requestedDate: string, confirmedDate: string): number | null => {
    if (requestedDate === 'N/A' || confirmedDate === 'N/A') return null;
    const requested = new Date(requestedDate);
    const confirmed = new Date(confirmedDate);
    const diffTime = confirmed.getTime() - requested.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const getSortedPOs = (): PO[] => {
    const sorted = [...pos];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (poSortColumn) {
        case 'po_number':
          aVal = (a.po_number || '').toLowerCase();
          bVal = (b.po_number || '').toLowerCase();
          return poSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'po_date':
          aVal = a.po_date;
          bVal = b.po_date;
          break;
        case 'order_qty':
          aVal = a.order_qty || 0;
          bVal = b.order_qty || 0;
          break;
        case 'total_amount':
          aVal = a.total_amount || 0;
          bVal = b.total_amount || 0;
          break;
        case 'requested_del_date':
          aVal = a.requested_del_date;
          bVal = b.requested_del_date;
          break;
        case 'confirmed_del_date':
          aVal = a.confirmed_del_date;
          bVal = b.confirmed_del_date;
          break;
        case 'days_early_late':
          aVal = calculateDaysEarlyLate(a.requested_del_date, a.confirmed_del_date) || 0;
          bVal = calculateDaysEarlyLate(b.requested_del_date, b.confirmed_del_date) || 0;
          break;
        case 'wh_receipt_date':
          aVal = a.wh_receipt_date;
          bVal = b.wh_receipt_date;
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          return poSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default:
          return 0;
      }

      if (poSortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return sorted;
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
                PO Spend {sortColumn === 'po_spend' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('po_spend_pct')}>
                % Spend {sortColumn === 'po_spend_pct' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => handleHeaderClick('wow_spend_change')}>
                Δ from prior week {sortColumn === 'wow_spend_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => handleHeaderClick('wow_spend_pct_change')}>
                % Δ from prior week {sortColumn === 'wow_spend_pct_change' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '75px' }} onClick={() => handleHeaderClick('cfy_spend_pct_change')}>
                % Δ LFQ {sortColumn === 'cfy_spend_pct_change' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                  {suppliers.reduce((sum, sup) => sum + calculateAvailableSpend(sup), 0) > 0
                    ? ((calculateAvailableSpend(s) / suppliers.reduce((sum, sup) => sum + calculateAvailableSpend(sup), 0)) * 100).toFixed(1)
                    : '0.0'}%
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
                <td
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    borderBottom: '1px solid #eee',
                    color: (s.cfy_spend_pct_change || 0) > 0 ? '#4caf50' : (s.cfy_spend_pct_change || 0) < 0 ? '#f44336' : '#000',
                    fontSize: 11,
                  }}
                >
                  {s.cfy_spend_pct_change ? `${s.cfy_spend_pct_change > 0 ? '▲' : '▼'} ${Math.abs(s.cfy_spend_pct_change).toFixed(1)}%` : 'N/A'}
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
                      <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('part_number')}>
                        Part Number {partsSortColumn === 'part_number' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('part_description')}>
                        Description {partsSortColumn === 'part_description' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('qty_on_order')}>
                        On Order {partsSortColumn === 'qty_on_order' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('qty_in_transit')}>
                        In Transit {partsSortColumn === 'qty_in_transit' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('qty_on_hand')}>
                        On Hand {partsSortColumn === 'qty_on_hand' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('po_count')}>
                        Total Qty {partsSortColumn === 'po_count' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('total_amount')}>
                        Total Spend {partsSortColumn === 'total_amount' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePartsHeaderClick('spend_pct')}>
                        % Spend {partsSortColumn === 'spend_pct' && (partsSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedParts(parts).map((p, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', cursor: 'pointer' }} onClick={() => handlePartClick(p)}>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11, color: '#1976d2', textDecoration: 'underline' }}>
                          {p.part_number}
                        </td>
                        <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11, textAlign: 'left' }}>
                          {p.part_description}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_on_order)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_in_transit)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {formatNumber(p.qty_on_hand)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {p.po_count}
                        </td>
                        <td style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #eee' }}>
                          {formatCurrency(p.total_amount)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {parts.reduce((sum, part) => sum + (part.total_amount || 0), 0) > 0
                            ? ((p.total_amount || 0) / parts.reduce((sum, part) => sum + (part.total_amount || 0), 0) * 100).toFixed(1)
                            : '0.0'}%
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

      {selectedPart && (
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
            zIndex: 1001,
          }}
          onClick={() => {
            setSelectedPart(null);
            setPos([]);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 8,
              padding: 30,
              maxWidth: '95%',
              maxHeight: '90%',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>{selectedSupplier?.supplier} - {selectedPart.part_number}</h2>
              <button
                onClick={() => {
                  setSelectedPart(null);
                  setPos([]);
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

            {loadingPOs ? (
              <div>Loading POs...</div>
            ) : pos.length === 0 ? (
              <div>No POs found for this part.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('po_number')}>
                        PO Number {poSortColumn === 'po_number' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('po_date')}>
                        PO Date {poSortColumn === 'po_date' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('order_qty')}>
                        Order Qty {poSortColumn === 'order_qty' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('total_amount')}>
                        Total Amount {poSortColumn === 'total_amount' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('requested_del_date')}>
                        Requested Del Date {poSortColumn === 'requested_del_date' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('confirmed_del_date')}>
                        Confirmed Del Date {poSortColumn === 'confirmed_del_date' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('days_early_late')}>
                        Days Confirmed Early/Late {poSortColumn === 'days_early_late' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('wh_receipt_date')}>
                        WH Receipt Date {poSortColumn === 'wh_receipt_date' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer' }} onClick={() => handlePoHeaderClick('status')}>
                        Status {poSortColumn === 'status' && (poSortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedPOs().map((po, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.po_number}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.po_date}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {formatNumber(po.order_qty)}
                        </td>
                        <td style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #eee' }}>
                          {formatCurrency(po.total_amount)}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.requested_del_date}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.confirmed_del_date}
                        </td>
                        <td style={{
                          padding: 10,
                          textAlign: 'center',
                          borderBottom: '1px solid #eee',
                          color: (() => {
                            const days = calculateDaysEarlyLate(po.requested_del_date, po.confirmed_del_date);
                            return days === null ? '#000' : days > 0 ? '#f44336' : '#4caf50';
                          })()
                        }}>
                          {(() => {
                            const days = calculateDaysEarlyLate(po.requested_del_date, po.confirmed_del_date);
                            if (days === null) return 'N/A';
                            return days > 0 ? `${days} days late` : `${Math.abs(days)} days early`;
                          })()}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.wh_receipt_date}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          {po.status}
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
/* cache bust */
