const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  async getSummary() {
    const res = await fetch(`${API_BASE}/summary`);
    return res.json();
  },

  async getTrends() {
    const res = await fetch(`${API_BASE}/trends`);
    return res.json();
  },

  async getSuppliers() {
    const res = await fetch(`${API_BASE}/suppliers`);
    return res.json();
  },

  async getSupplierTrends(supplier: string) {
    const res = await fetch(`${API_BASE}/suppliers/${encodeURIComponent(supplier)}/trends`);
    return res.json();
  },

  async getDeliveryVariance() {
    const res = await fetch(`${API_BASE}/delivery-variance`);
    return res.json();
  },

  async getInventoryByStatus() {
    const res = await fetch(`${API_BASE}/inventory/by-status`);
    return res.json();
  },

  async triggerIngest() {
    const res = await fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.json();
  },
};
