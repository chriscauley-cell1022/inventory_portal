import React, { useState, useEffect } from 'react';
import { apiClient } from '../api';

interface ExpiringItem {
  supplier: string;
  po_number: string;
  part_number: string;
  part_description: string;
  final_delivery_date: string;
  inventory_age: number;
  days_remaining: number;
  quantity: number;
  po_amount: number;
  po_quantity: number;
}

interface ExpiringInventoryProps {
  triggerRefresh: number;
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

const getSortedItems = (
  items: ExpiringItem[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc'
): ExpiringItem[] => {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortColumn) {
      case 'supplier':
        aVal = (a.supplier || '').toLowerCase();
        bVal = (b.supplier || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'po_number':
        aVal = (a.po_number || '').toLowerCase();
        bVal = (b.po_number || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'part_number':
        aVal = (a.part_number || '').toLowerCase();
        bVal = (b.part_number || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'part_description':
        aVal = (a.part_description || '').toLowerCase();
        bVal = (b.part_description || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'quantity':
        aVal = a.quantity || 0;
        bVal = b.quantity || 0;
        break;
      case 'inventory_amount':
        aVal = (a.quantity * a.po_amount) / a.po_quantity || 0;
        bVal = (b.quantity * b.po_amount) / b.po_quantity || 0;
        break;
      case 'days_remaining':
        aVal = a.days_remaining || 0;
        bVal = b.days_remaining || 0;
        break;
      case 'inventory_age':
        aVal = a.inventory_age || 0;
        bVal = b.inventory_age || 0;
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

const ExpiringInventory: React.FC<ExpiringInventoryProps> = ({ triggerRefresh }) => {
  const [data, setData] = useState<{ overdue_items: ExpiringItem[]; expiring_60_days: ExpiringItem[]; expiring_30_days: ExpiringItem[]; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortColumn30, setSortColumn30] = useState<string>('days_remaining');
  const [sortDirection30, setSortDirection30] = useState<'asc' | 'desc'>('asc');
  const [sortColumn60, setSortColumn60] = useState<string>('days_remaining');
  const [sortDirection60, setSortDirection60] = useState<'asc' | 'desc'>('asc');

  const handleHeaderClick30 = (column: string) => {
    if (sortColumn30 === column) {
      setSortDirection30(sortDirection30 === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn30(column);
      setSortDirection30('asc');
    }
  };

  const handleHeaderClick60 = (column: string) => {
    if (sortColumn60 === column) {
      setSortDirection60(sortDirection60 === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn60(column);
      setSortDirection60('asc');
    }
  };

  useEffect(() => {
    loadData();
  }, [triggerRefresh]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getExpiringInventory();
      setData(result);
    } catch (err) {
      console.error('Error loading expiring inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading expiring inventory...</div>;
  }

  if (!data) {
    return <div>No expiring inventory data available</div>;
  }

  const safeData = {
    overdue_items: data.overdue_items || [],
    expiring_30_days: data.expiring_30_days || [],
    expiring_60_days: data.expiring_60_days || [],
    date: data.date || new Date().toISOString().split('T')[0],
  };

  const ExpiringTable: React.FC<{ items: ExpiringItem[]; title: string; hideTitle?: boolean; sortColumn: string; sortDirection: 'asc' | 'desc'; onHeaderClick: (col: string) => void }> = ({ items = [], title, hideTitle = false, sortColumn, sortDirection, onHeaderClick }) => (
    <div style={{ marginBottom: 40, maxWidth: 1200, margin: '10px auto 40px auto' }}>
      {!hideTitle && <h3 style={{ textAlign: 'center', margin: '0 0 15px 0' }}>{title}</h3>}
      {(!items || items.length === 0) ? (
        <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>No items in this category</div>
      ) : (
        <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => onHeaderClick('supplier')}>
                  Supplier {sortColumn === 'supplier' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => onHeaderClick('po_number')}>
                  PO Number {sortColumn === 'po_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => onHeaderClick('part_number')}>
                  Part Number {sortColumn === 'part_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => onHeaderClick('part_description')}>
                  Part Description {sortColumn === 'part_description' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '80px' }} onClick={() => onHeaderClick('quantity')}>
                  Quantity {sortColumn === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => onHeaderClick('inventory_amount')}>
                  Inventory Amount {sortColumn === 'inventory_amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', whiteSpace: 'normal', width: '110px' }}>
                  Final Delivery Date
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '100px' }} onClick={() => onHeaderClick('inventory_age')}>
                  Inventory Age {sortColumn === 'inventory_age' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'normal', width: '90px' }} onClick={() => onHeaderClick('days_remaining')}>
                  Days Remaining {sortColumn === 'days_remaining' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedItems(items, sortColumn, sortDirection).map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white',
                  }}
                >
                  <td style={{ padding: 12, borderBottom: '1px solid #eee', textAlign: 'center', fontSize: 11 }}>
                    {item.supplier}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11, textAlign: 'center' }}>
                    {item.po_number}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11, textAlign: 'center' }}>
                    {item.part_number}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #eee', fontSize: 11, textAlign: 'center', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                    {item.part_description}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                    {item.quantity.toLocaleString()}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                    {item.po_amount && item.po_quantity && item.po_quantity > 0
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                          (item.quantity * item.po_amount) / item.po_quantity
                        )
                      : '-'}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11 }}>
                    {formatDateEuropean(item.final_delivery_date)}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #eee' }}>
                    {item.inventory_age}
                  </td>
                  <td
                    style={{
                      padding: 12,
                      textAlign: 'center',
                      borderBottom: '1px solid #eee',
                      color: item.days_remaining <= 10 ? '#f44336' : item.days_remaining <= 20 ? '#ff9800' : '#666',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.days_remaining}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', border: '1px solid #ddd', borderRadius: 8, padding: 20 }}>
      <h2 style={{ marginTop: 0, textAlign: 'center' }}>Inventory Approaching Expiration</h2>

      {safeData.overdue_items.length > 0 && (
        <div style={{ marginBottom: 50, padding: 15, backgroundColor: '#ffebee', border: '2px solid #f44336', borderRadius: 4 }}>
          <h3 style={{ color: '#c62828', marginTop: 0 }}>⚠️ OVERDUE - Past Expiration Date (Not Called Off)</h3>
          <ExpiringTable items={safeData.overdue_items} title="" hideTitle={true} sortColumn={sortColumn30} sortDirection={sortDirection30} onHeaderClick={handleHeaderClick30} />
        </div>
      )}

      <ExpiringTable items={safeData.expiring_30_days} title="Within 30 Days of Expiration" sortColumn={sortColumn30} sortDirection={sortDirection30} onHeaderClick={handleHeaderClick30} />
      <div style={{
        height: '1px',
        background: '#1976d2',
        margin: '30px auto',
        maxWidth: '70%',
        width: '100%'
      }}></div>
      <ExpiringTable items={safeData.expiring_60_days} title="Within 60 Days of Expiration" sortColumn={sortColumn60} sortDirection={sortDirection60} onHeaderClick={handleHeaderClick60} />
    </div>
  );
};

export default ExpiringInventory;
