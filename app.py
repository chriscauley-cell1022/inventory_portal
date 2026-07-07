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
        'total_po_spend': round(metric.total_po_spend or 0, 2),
        'total_po_quantity': metric.total_po_quantity or 0,
        'total_qty_on_order': metric.total_qty_on_order or 0,
        'total_qty_in_transit': metric.total_qty_in_transit or 0,
        'total_qty_on_hand': metric.total_qty_on_hand or 0,
        'total_qty_called_off': metric.total_qty_called_off or 0,
        'wow_spend_change': round(metric.wow_spend_change or 0, 2),
        'wow_spend_pct_change': round(metric.wow_spend_pct_change, 1) if metric.wow_spend_pct_change else None,
        'wow_quantity_change': metric.wow_quantity_change or 0,
        'wow_quantity_pct_change': round(metric.wow_quantity_pct_change, 1) if metric.wow_quantity_pct_change else None,
        'mom_spend_change': round(metric.mom_spend_change or 0, 2),
        'mom_spend_pct_change': round(metric.mom_spend_pct_change, 1) if metric.mom_spend_pct_change else None,
        'mom_quantity_change': metric.mom_quantity_change or 0,
        'mom_quantity_pct_change': round(metric.mom_quantity_pct_change, 1) if metric.mom_quantity_pct_change else None,
    })

@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get historical trends for charting"""
    metrics = MetricSnapshot.query.order_by(MetricSnapshot.snapshot_date).all()

    data = []
    for m in metrics:
        data.append({
            'date': str(m.snapshot_date),
            'total_po_spend': round(m.total_po_spend or 0, 2),
            'total_po_quantity': m.total_po_quantity or 0,
            'total_qty_on_order': m.total_qty_on_order or 0,
            'total_qty_in_transit': m.total_qty_in_transit or 0,
            'total_qty_on_hand': m.total_qty_on_hand or 0,
            'total_qty_called_off': m.total_qty_called_off or 0,
        })

    return jsonify(data)

@app.route('/api/suppliers', methods=['GET'])
def get_suppliers():
    """Get latest supplier metrics with WoW changes"""
    latest_date = db.session.query(func.max(SupplierMetric.snapshot_date)).scalar()

    if not latest_date:
        return jsonify([])

    suppliers = SupplierMetric.query.filter_by(snapshot_date=latest_date).order_by(SupplierMetric.total_po_spend.desc()).all()

    data = []
    for s in suppliers:
        wow_spend_pct = None
        wow_qty_pct = None

        if s.wow_spend_change is not None and s.total_po_spend is not None:
            prev_spend = s.total_po_spend - (s.wow_spend_change or 0)
            if prev_spend > 0:
                wow_spend_pct = (s.wow_spend_change / prev_spend) * 100

        if s.wow_qty_change is not None and s.total_po_quantity is not None:
            prev_qty = s.total_po_quantity - (s.wow_qty_change or 0)
            if prev_qty > 0:
                wow_qty_pct = (s.wow_qty_change / prev_qty) * 100

        data.append({
            'supplier': s.supplier,
            'total_po_spend': round(s.total_po_spend or 0, 2),
            'total_po_quantity': s.total_po_quantity or 0,
            'total_qty_on_order': s.total_qty_on_order or 0,
            'total_qty_in_transit': s.total_qty_in_transit or 0,
            'total_qty_on_hand': s.total_qty_on_hand or 0,
            'total_qty_called_off': s.total_qty_called_off or 0,
            'avg_delivery_variance_days': round(s.avg_delivery_variance_days or 0, 1),
            'po_count': s.po_count or 0,
            'wow_spend_change': round(s.wow_spend_change or 0, 2),
            'wow_spend_pct_change': round(wow_spend_pct, 1) if wow_spend_pct is not None else None,
            'wow_qty_change': s.wow_qty_change or 0,
            'wow_qty_pct_change': round(wow_qty_pct, 1) if wow_qty_pct is not None else None,
        })

    return jsonify(data)

@app.route('/api/suppliers/<supplier>/parts', methods=['GET'])
def get_supplier_parts(supplier):
    """Get part numbers for a supplier with latest inventory status"""
    latest_date = db.session.query(func.max(InventorySnapshot.report_date)).scalar()

    if not latest_date:
        return jsonify([])

    parts = db.session.query(InventorySnapshot).filter_by(
        report_date=latest_date,
        supplier=supplier
    ).order_by(InventorySnapshot.part_number).all()

    data = []
    for p in parts:
        data.append({
            'part_number': p.part_number or 'N/A',
            'part_description': p.part_description or '',
            'po_number': p.po_number,
            'qty_on_order': p.qty_on_order or 0,
            'qty_in_transit': p.qty_in_transit or 0,
            'qty_on_hand': p.qty_on_hand or 0,
            'total_po_amount': round(p.total_po_amount or 0, 2),
            'po_quantity': p.po_quantity or 0,
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
            'total_po_spend': round(m.total_po_spend or 0, 2),
            'total_po_quantity': m.total_po_quantity or 0,
            'total_qty_on_order': m.total_qty_on_order or 0,
            'total_qty_in_transit': m.total_qty_in_transit or 0,
            'total_qty_on_hand': m.total_qty_on_hand or 0,
            'total_qty_called_off': m.total_qty_called_off or 0,
            'avg_delivery_variance_days': m.avg_delivery_variance_days or 0,
            'wow_spend_change': m.wow_spend_change,
            'wow_qty_change': m.wow_qty_change,
        })

    return jsonify(data)

@app.route('/api/delivery-variance', methods=['GET'])
def get_delivery_variance():
    """Get delivery variance summary by supplier"""
    latest_date = db.session.query(func.max(SupplierMetric.snapshot_date)).scalar()

    if not latest_date:
        return jsonify([])

    suppliers = SupplierMetric.query.filter_by(snapshot_date=latest_date).order_by(SupplierMetric.avg_delivery_variance_days.desc()).all()

    data = []
    for s in suppliers:
        data.append({
            'supplier': s.supplier,
            'avg_delivery_variance_days': round(s.avg_delivery_variance_days or 0, 1),
            'po_count': s.po_count or 0,
        })

    return jsonify(data)

@app.route('/api/ingest', methods=['POST'])
def trigger_ingest():
    """Manually trigger data ingestion from folder"""
    folder_path = request.json.get('folder_path', '/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD') if request.json else '/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD'

    try:
        ingest_all_files(app, folder_path)
        return jsonify({'status': 'success', 'message': 'Data ingestion completed'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/inventory/by-status', methods=['GET'])
def get_inventory_by_status():
    """Get inventory breakdown by status (latest snapshot only)"""
    latest_date = db.session.query(func.max(MetricSnapshot.snapshot_date)).scalar()

    if not latest_date:
        return jsonify({'error': 'No data available'}), 404

    metric = MetricSnapshot.query.filter_by(snapshot_date=latest_date).first()

    return jsonify({
        'date': str(latest_date),
        'on_order': metric.total_qty_on_order or 0,
        'in_transit': metric.total_qty_in_transit or 0,
        'on_hand': metric.total_qty_on_hand or 0,
        'called_off': metric.total_qty_called_off or 0,
    })

if __name__ == '__main__':
    import os
    port = int(os.environ.get('FLASK_PORT', 5001))
    app.run(debug=True, port=port, host='127.0.0.1')
