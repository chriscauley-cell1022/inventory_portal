import React, { useEffect, useState } from 'react';
import './App.css';
import { apiClient } from './api';
import InventorySummary from './components/InventorySummary';
import SupplierAnalysis from './components/SupplierAnalysis';
import TrendChart from './components/TrendChart';
import ExpiringInventory from './components/ExpiringInventory';

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

interface Database {
  filename: string;
  path: string;
  size_mb: number;
  date: string;
  is_current?: boolean;
}

function App() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState<string | null>(null);

  useEffect(() => {
    loadDatabases();
    loadData();
  }, []);

  const loadDatabases = async () => {
    try {
      const response = await fetch('/api/databases');
      const data = await response.json();
      setDatabases(data);
    } catch (err) {
      console.error('Error loading databases:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, trendsData, suppliersData] = await Promise.all([
        apiClient.getSummary(),
        apiClient.getTrends(),
        apiClient.getSuppliers(),
      ]);

      setSummary(summaryData);
      setTrends(trendsData || []);
      setSuppliers(suppliersData || []);
    } catch (err) {
      setError(`Error loading data: ${err}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDatabaseSwitch = async (dbPath: string) => {
    if (dbPath === 'current') {
      setSelectedSnapshotDate(null);
      return;
    }

    // Extract date from the selected database option
    const selectedDb = databases.find(db => db.path === dbPath);
    if (selectedDb) {
      setSelectedSnapshotDate(selectedDb.date);
    }

    // For switching to historical databases, would need to implement backend support
    // For now, this is a UI placeholder showing available snapshots
    // alert(`Database switching would require backend support. Available snapshot: ${dbPath}`);
  };

  const handleIngest = async () => {
    setLoading(true);
    try {
      await apiClient.triggerIngest();
      setTimeout(() => {
        loadData();
      }, 2000);
    } catch (err) {
      setError(`Ingest failed: ${err}`);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header style={{ backgroundColor: '#f5f5f5', color: '#333', padding: 20, position: 'relative', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, borderBottom: '2px solid #1976d2' }}>
        <div style={{ position: 'absolute', left: 20, top: 50, transform: 'translateY(-50%)', height: 70 }}>
          <img src="/SAP_Taulia_R_grad_blu.png" alt="SAP Taulia" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px 0', color: '#333' }}>Inventory & Supplier Analysis</h1>
          <p style={{ margin: '0 0 0 0', fontSize: 18, color: '#666' }}>
            (for Orebro PC-SRD as of {selectedSnapshotDate || (summary && (summary as any).date ? formatDateEuropean((summary as any).date) : 'loading...')})
          </p>
        </div>

        <div style={{ position: 'absolute', right: 20, top: 20, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <button
            onClick={handleIngest}
            style={{
              padding: '6px 14px',
              backgroundColor: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            Refresh Data
          </button>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <label style={{ color: '#333', fontSize: 10, fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap' }}>Snapshot:</label>
            <select
              onChange={(e) => handleDatabaseSwitch(e.target.value)}
              style={{
                padding: '3px 6px',
                borderRadius: 3,
                border: '1px solid #1976d2',
                fontSize: 10,
                backgroundColor: '#fff',
                color: '#333',
                cursor: 'pointer',
              }}
              title="Select a database snapshot to view historical data"
            >
              <option value="current">Current (Live)</option>
              {databases.map((db) => (
                <option key={db.path} value={db.path}>
                  {db.date} ({db.size_mb}MB)
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
        {error && (
          <div
            style={{
              backgroundColor: '#ffebee',
              color: '#c62828',
              padding: 16,
              borderRadius: 4,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <InventorySummary data={summary} suppliers={suppliers} />

            {trends.length > 0 && (
              <>
                <div style={{ maxWidth: 1200, margin: '0 auto', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                  <TrendChart
                    data={trends}
                    title="PO Spend"
                    xAxisLabel=""
                    yAxisLabel="Open Spend (€)"
                    lines={[
                      { dataKey: 'open_po_spend', name: 'Open PO Spend (€)', color: '#8884d8' },
                    ]}
                  />
                </div>

                <div style={{ maxWidth: 1200, margin: '0 auto', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                  <TrendChart
                    data={trends}
                    title="Inventory Value by Status"
                    xAxisLabel=""
                    yAxisLabel="Spend (€)"
                    lines={[
                      { dataKey: 'spend_on_order', name: 'On Order', color: '#ffc658' },
                      { dataKey: 'spend_in_transit', name: 'In Transit', color: '#ff7c7c' },
                      { dataKey: 'spend_on_hand', name: 'On Hand', color: '#8dd63d' },
                    ]}
                  />
                </div>
              </>
            )}

            <SupplierAnalysis suppliers={suppliers} />

            <ExpiringInventory triggerRefresh={trends.length} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
