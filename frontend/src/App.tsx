import React, { useEffect, useState } from 'react';
import './App.css';
import { apiClient } from './api';
import InventorySummary from './components/InventorySummary';
import SupplierAnalysis from './components/SupplierAnalysis';
import TrendChart from './components/TrendChart';

function App() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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

  const handleIngest = async () => {
    try {
      await apiClient.triggerIngest();
      setTimeout(loadData, 2000);
    } catch (err) {
      setError(`Ingest failed: ${err}`);
    }
  };

  return (
    <div className="App">
      <header style={{ backgroundColor: '#1976d2', color: 'white', padding: 20 }}>
        <h1>Inventory Reporting & Supplier Analysis Portal</h1>
        <button
          onClick={handleIngest}
          style={{
            padding: '10px 20px',
            backgroundColor: '#fff',
            color: '#1976d2',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Refresh Data
        </button>
      </header>

      <main style={{ padding: 20 }}>
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
            <InventorySummary data={summary} />

            {trends.length > 0 && (
              <>
                <TrendChart
                  data={trends}
                  title="Open PO Spend Trend (WoW)"
                  xAxisLabel="Week"
                  yAxisLabel="Open Spend (€)"
                  lines={[
                    { dataKey: 'open_po_spend', name: 'Open PO Spend (€)', color: '#8884d8' },
                  ]}
                />

                <TrendChart
                  data={trends}
                  title="Inventory Value by Status"
                  xAxisLabel="Week"
                  yAxisLabel="Spend (€)"
                  lines={[
                    { dataKey: 'spend_on_order', name: 'On Order', color: '#ffc658' },
                    { dataKey: 'spend_in_transit', name: 'In Transit', color: '#ff7c7c' },
                    { dataKey: 'spend_on_hand', name: 'On Hand', color: '#8dd63d' },
                  ]}
                />
              </>
            )}

            <SupplierAnalysis suppliers={suppliers} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
