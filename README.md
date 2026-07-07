# Inventory Reporting & Supplier Analysis Portal

A web-based portal for tracking DWM inventory metrics, supplier performance, and delivery variance analysis.

## Features

- **Inventory Summary**: Current PO spend, quantities, and inventory levels by status
- **Week-over-Week & Month-over-Month Trends**: Track growth rates in spend and quantities
- **Supplier Analysis**: 
  - Top suppliers by PO spend
  - Delivery performance metrics (early/late vs. target)
  - Inventory breakdown by supplier
- **Interactive Charts**: Visualize trends over time using Recharts
- **Automatic Data Ingestion**: Reads weekly inventory files from Google Drive folder

## Quick Start

### Initial Setup

```bash
chmod +x setup.sh run.sh
./setup.sh
```

### Running the Portal

```bash
./run.sh
```

The portal will be available at `http://localhost:3000`

Backend API runs on `http://localhost:5000/api`

## Project Structure

```
inventory_portal/
├── app.py                 # Flask backend API
├── models.py              # Database models
├── ingest.py              # Data ingestion logic
├── inventory.db           # SQLite database
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api.ts         # API client
│   │   ├── App.tsx        # Main component
│   │   └── components/    # React components
│   └── package.json
└── requirements.txt       # Python dependencies
```

## Data Ingestion

The portal automatically reads inventory files from:
```
/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD/
```

Files should be named with a date pattern: `*MMDDYY*.xlsx`

To manually trigger data ingestion, click "Refresh Data" in the portal or:
```bash
curl -X POST http://localhost:5000/api/ingest
```

## API Endpoints

- `GET /api/summary` - Current inventory summary
- `GET /api/trends` - Historical trends data
- `GET /api/suppliers` - Supplier metrics
- `GET /api/suppliers/<name>/trends` - Supplier-specific trends
- `GET /api/delivery-variance` - Delivery variance by supplier
- `GET /api/inventory/by-status` - Inventory breakdown by status
- `POST /api/ingest` - Trigger data ingestion

## Database Schema

### InventorySnapshot
Stores individual PO data from each weekly report:
- PO number, supplier, quantities, amounts
- Delivery dates (target vs. confirmed)
- Inventory levels by status

### MetricSnapshot
Aggregated metrics by week:
- Total spend and quantities
- WoW/MoM growth rates
- Inventory status totals

### SupplierMetric
Aggregated supplier-level metrics:
- Total spend and quantities by supplier
- Average delivery variance
- PO count

## Metrics Calculated

### Week-over-Week (WoW)
- Change in total PO spend (amount and %)
- Change in total PO quantity (amount and %)

### Month-over-Month (MoM)
- Change in total PO spend (amount and %)
- Change in total PO quantity (amount and %)

### Delivery Variance
- Days early/late vs. expected delivery date
- Calculated per supplier as average across all POs

## Adding New Weekly Reports

Simply add new Excel files to the inventory folder. The file naming should follow the pattern:
- `Orebro Inventory Report_DWM-Taulia MMDDYY.xlsx`
- Or any file with a 6-digit date pattern `MMDDYY`

Click "Refresh Data" in the portal to ingest the new file.

## Technology Stack

**Backend:**
- Flask (Python web framework)
- SQLAlchemy (ORM)
- SQLite (Database)
- Pandas (Data processing)
- OpenPyXL (Excel parsing)

**Frontend:**
- React 18 (TypeScript)
- Recharts (Data visualization)
- CSS (Styling)

## Troubleshooting

### Backend won't start
```bash
pip3 install -r requirements.txt
python3 app.py
```

### Frontend won't start
```bash
cd frontend
npm install
npm start
```

### Database issues
```bash
rm inventory.db
python3 app.py  # Will recreate the database
```

### Data not loading in portal
1. Check that backend is running on port 5000
2. Click "Refresh Data" button
3. Check browser console for errors (F12)
