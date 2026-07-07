from flask import Flask, jsonify, request
from flask_cors import CORS
from models import db, InventorySnapshot, MetricSnapshot, SupplierMetric, DeliveryVariance
from ingest import ingest_all_files
import os
from datetime import datetime, timedelta
from sqlalchemy import func

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{basedir}/inventory.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Get current summary metrics"""
    latest_date = db.session.query(func.max(MetricSnapshot.snapshot_date)).scalar()

    if not latest_date:
        return jsonify({'error': 'No data available'}), 404

    metric = MetricSnapshot.query.filter_by(snapshot_date=latest_date).first()

    return jsonify({
        'date': str(latest_date),
        'total_po_spend': metric.total_po_spend,
        'total_po_quantity': metric.total_po_quantity,
        'total_qty_on_order': metric.total_qty_on_order,
        'total_qty_in_transit': metric.total_qty_in_transit,
        'total_qty_on_hand': metric.total_qty_on_hand,
        'total_qty_called_off': metric.total_qty_called_off,
        'wow_spend_change': metric.wow_spend_change,
        'wow_spend_pct_change': metric.wow_spend_pct_change,
        'wow_quantity_change': metric.wow_quantity_change,
        'wow_quantity_pct_change': metric.wow_quantity_pct_change,
        'mom_spend_change': metric.mom_spend_change,
        'mom_spend_pct_change': metric.mom_spend_pct_change,
        'mom_quantity_change': metric.mom_quantity_change,
        'mom_quantity_pct_change': metric.mom_quantity_pct_change,
    })

@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get historical trends for charting"""
    metrics = MetricSnapshot.query.order_by(MetricSnapshot.snapshot_date).all()

    data = []
    for m in metrics:
        data.append({
            'date': str(m.snapshot_date),
            'total_po_spend': m.total_po_spend,
            'total_po_quantity': m.total_po_quantity,
            'total_qty_on_order': m.total_qty_on_order,
            'total_qty_in_transit': m.total_qty_in_transit,
            'total_qty_on_hand': m.total_qty_on_hand,
            'total_qty_called_off': m.total_qty_called_off,
            'wow_spend_pct_change': m.wow_spend_pct_change,
            'wow_quantity_pct_change': m.wow_quantity_pct_change,
        })

    return jsonify(data)

@app.route('/api/suppliers', methods=['GET'])
def get_suppliers():
    """Get latest supplier metrics"""
    latest_date = db.session.query(func.max(SupplierMetric.snapshot_date)).scalar()

    if not latest_date:
        return jsonify([])

    suppliers = SupplierMetric.query.filter_by(snapshot_date=latest_date).order_by(SupplierMetric.total_po_spend.desc()).all()

    data = []
    for s in suppliers:
        data.append({
            'supplier': s.supplier,
            'total_po_spend': s.total_po_spend,
            'total_po_quantity': s.total_po_quantity,
            'total_qty_on_order': s.total_qty_on_order,
            'total_qty_in_transit': s.total_qty_in_transit,
            'total_qty_on_hand': s.total_qty_on_hand,
            'total_qty_called_off': s.total_qty_called_off,
            'avg_delivery_variance_days': s.avg_delivery_variance_days,
            'po_count': s.po_count,
        })

    return jsonify(data)

@app.route('/api/suppliers/<supplier>/trends', methods=['GET'])
def get_supplier_trends(supplier):
    """Get historical trends for a specific supplier"""
    metrics = SupplierMetric.query.filter_by(supplier=supplier).order_by(SupplierMetric.snapshot_date).all()

    data = []
    for m in metrics:
        data.append({
            'date': str(m.snapshot_date),
            'total_po_spend': m.total_po_spend,
            'total_po_quantity': m.total_po_quantity,
            'total_qty_on_order': m.total_qty_on_order,
            'total_qty_in_transit': m.total_qty_in_transit,
            'total_qty_on_hand': m.total_qty_on_hand,
            'total_qty_called_off': m.total_qty_called_off,
            'avg_delivery_variance_days': m.avg_delivery_variance_days,
        })

    return jsonify(data)

@app.route('/api/delivery-variance', methods=['GET'])
def get_delivery_variance():
    """Get delivery variance summary by supplier"""
    latest_date = db.session.query(func.max(SupplierMetric.snapshot_date)).scalar()

    if not latest_date:
        return jsonify([])

    suppliers = SupplierMetric.query.filter_by(snapshot_date=latest_date).all()

    data = []
    for s in suppliers:
        data.append({
            'supplier': s.supplier,
            'avg_delivery_variance_days': s.avg_delivery_variance_days,
            'po_count': s.po_count,
        })

    return jsonify(data)

@app.route('/api/ingest', methods=['POST'])
def trigger_ingest():
    """Manually trigger data ingestion from folder"""
    folder_path = request.json.get('folder_path', '/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD')

    try:
        ingest_all_files(app, folder_path)
        return jsonify({'status': 'success', 'message': 'Data ingestion completed'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/inventory/by-status', methods=['GET'])
def get_inventory_by_status():
    """Get inventory breakdown by status (On Order, In Transit, On Hand, Called Off)"""
    latest_date = db.session.query(func.max(MetricSnapshot.snapshot_date)).scalar()

    if not latest_date:
        return jsonify({'error': 'No data available'}), 404

    metric = MetricSnapshot.query.filter_by(snapshot_date=latest_date).first()

    return jsonify({
        'date': str(latest_date),
        'on_order': metric.total_qty_on_order,
        'in_transit': metric.total_qty_in_transit,
        'on_hand': metric.total_qty_on_hand,
        'called_off': metric.total_qty_called_off,
    })

if __name__ == '__main__':
    import os
    port = int(os.environ.get('FLASK_PORT', 5001))
    app.run(debug=True, port=port, host='127.0.0.1')
