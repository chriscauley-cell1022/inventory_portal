from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from models import db, InventorySnapshot, MetricSnapshot, SupplierMetric, DeliveryVariance
from ingest import ingest_all_files
import os
from datetime import datetime, timedelta
from sqlalchemy import func

basedir = os.path.abspath(os.path.dirname(__file__))
frontend_build = os.path.join(basedir, 'frontend', 'build')

app = Flask(__name__, static_folder=frontend_build, static_url_path='')
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{basedir}/inventory.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    # Auto-ingest data on startup if database is empty and data folder exists
    latest_date = db.session.query(func.max(MetricSnapshot.snapshot_date)).scalar()
    if not latest_date:
        data_folder = os.environ.get('DATA_FOLDER', os.path.join(basedir, 'OrebroSRD'))
        if os.path.exists(data_folder):
            try:
                ingest_all_files(app, data_folder)
                print(f"Auto-ingested data from {data_folder}")
            except Exception as e:
                print(f"Auto-ingest failed: {e}")

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
        'open_po_spend': round(metric.open_po_spend or 0, 2),
        'total_qty_on_order': metric.total_qty_on_order or 0,
        'total_qty_in_transit': metric.total_qty_in_transit or 0,
        'total_qty_on_hand': metric.total_qty_on_hand or 0,
        'spend_on_order': round(metric.spend_on_order or 0, 2),
        'spend_in_transit': round(metric.spend_in_transit or 0, 2),
        'spend_on_hand': round(metric.spend_on_hand or 0, 2),
    })

@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get historical trends for charting"""
    metrics = MetricSnapshot.query.order_by(MetricSnapshot.snapshot_date).all()

    data = []
    for i, m in enumerate(metrics):
        # Calculate WoW change for open PO spend
        wow_pct = None
        if i > 0:
            prev_m = metrics[i - 1]
            if prev_m.open_po_spend and prev_m.open_po_spend > 0:
                wow_change = (m.open_po_spend or 0) - prev_m.open_po_spend
                wow_pct = (wow_change / prev_m.open_po_spend) * 100

        data.append({
            'date': str(m.snapshot_date),
            'open_po_spend': round(m.open_po_spend or 0, 2),
            'spend_on_order': round(m.spend_on_order or 0, 2),
            'spend_in_transit': round(m.spend_in_transit or 0, 2),
            'spend_on_hand': round(m.spend_on_hand or 0, 2),
            'total_qty_on_order': m.total_qty_on_order or 0,
            'total_qty_in_transit': m.total_qty_in_transit or 0,
            'total_qty_on_hand': m.total_qty_on_hand or 0,
            'wow_pct': round(wow_pct, 1) if wow_pct is not None else None,
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
    # Allow folder path to be specified via environment variable or request
    default_folder = os.environ.get('DATA_FOLDER', os.path.join(basedir, 'OrebroSRD'))
    folder_path = request.json.get('folder_path', default_folder) if request.json else default_folder

    try:
        ingest_all_files(app, folder_path)
        return jsonify({'status': 'success', 'message': 'Data ingestion completed', 'folder': folder_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e), 'attempted_folder': folder_path}), 500

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

@app.route('/api/inventory/expiring', methods=['GET'])
def get_expiring_inventory():
    """Get inventory approaching expiration"""
    from datetime import date as date_type

    latest_date = db.session.query(func.max(InventorySnapshot.report_date)).scalar()

    if not latest_date:
        return jsonify({'error': 'No data available'}), 404

    # Get inventory with final delivery dates in the future (days_remaining > 0)
    # and that have actual inventory quantities
    inventory = InventorySnapshot.query.filter_by(
        report_date=latest_date
    ).filter(
        InventorySnapshot.final_delivery_date.isnot(None),
        InventorySnapshot.days_remaining.isnot(None),
        InventorySnapshot.days_remaining > 0,
        InventorySnapshot.po_quantity > 0
    ).all()

    # Aggregate by (supplier, po_number, part_number, final_delivery_date, days_remaining)
    # to sum quantities across multiple rows for same part in same PO
    agg_dict = {}

    for item in inventory:
        key = (
            item.supplier or '',
            item.po_number or '',
            item.part_number or 'N/A',
            str(item.final_delivery_date) if item.final_delivery_date else '',
            item.days_remaining or 0,
            item.inventory_age or 0,
        )

        # Calculate open quantity (not called off)
        qty = (item.qty_on_order or 0) + (item.qty_in_transit or 0) + (item.qty_on_hand or 0)

        if key not in agg_dict:
            agg_dict[key] = {
                'supplier': key[0],
                'po_number': key[1],
                'part_number': key[2],
                'part_description': item.part_description or '',
                'final_delivery_date': key[3],
                'inventory_age': key[5],
                'days_remaining': key[4],
                'quantity': 0,
                'po_amount': item.total_po_amount or 0,
                'po_quantity': item.po_quantity or 0,
            }

        agg_dict[key]['quantity'] += qty

    # Get overdue items (negative days_remaining but not yet called off)
    overdue_inventory = InventorySnapshot.query.filter_by(
        report_date=latest_date
    ).filter(
        InventorySnapshot.final_delivery_date.isnot(None),
        InventorySnapshot.days_remaining.isnot(None),
        InventorySnapshot.days_remaining < 0,
        InventorySnapshot.po_quantity > 0
    ).all()

    # Aggregate overdue items
    overdue_dict = {}
    for item in overdue_inventory:
        key = (
            item.supplier or '',
            item.po_number or '',
            item.part_number or 'N/A',
            str(item.final_delivery_date) if item.final_delivery_date else '',
            item.days_remaining or 0,
            item.inventory_age or 0,
        )

        qty = (item.qty_on_order or 0) + (item.qty_in_transit or 0) + (item.qty_on_hand or 0)

        if qty > 0:  # Only include if has actual quantity
            if key not in overdue_dict:
                overdue_dict[key] = {
                    'supplier': key[0],
                    'po_number': key[1],
                    'part_number': key[2],
                    'part_description': item.part_description or '',
                    'final_delivery_date': key[3],
                    'inventory_age': key[5],
                    'days_remaining': key[4],
                    'quantity': 0,
                    'po_amount': item.total_po_amount or 0,
                    'po_quantity': item.po_quantity or 0,
                }

            overdue_dict[key]['quantity'] += qty

    # Separate into 60-day, 30-day, and overdue buckets
    expiring_60 = []
    expiring_30 = []
    overdue = list(overdue_dict.values())

    for item_data in agg_dict.values():
        if item_data['quantity'] > 0:  # Only include items with actual quantity
            if item_data['days_remaining'] <= 60 and item_data['days_remaining'] > 30:
                expiring_60.append(item_data)

            if item_data['days_remaining'] <= 30 and item_data['days_remaining'] > 0:
                expiring_30.append(item_data)

    # Sort by days remaining (ascending for future dates, descending for overdue)
    expiring_60.sort(key=lambda x: x['days_remaining'])
    expiring_30.sort(key=lambda x: x['days_remaining'])
    overdue.sort(key=lambda x: x['days_remaining'], reverse=True)  # Reverse so most overdue first

    return jsonify({
        'date': str(latest_date),
        'overdue_items': overdue,
        'expiring_60_days': expiring_60,
        'expiring_30_days': expiring_30,
    })

@app.route('/')
def serve_index():
    """Serve the React app"""
    index_path = os.path.join(frontend_build, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(frontend_build, 'index.html')
    return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404

@app.route('/<path:path>')
def serve_react(path):
    """Serve React app assets or fall back to index.html"""
    file_path = os.path.join(frontend_build, path)
    if os.path.isfile(file_path):
        return send_from_directory(frontend_build, path)
    # Fall back to index.html for React Router
    index_path = os.path.join(frontend_build, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(frontend_build, 'index.html')
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', os.environ.get('PORT', 5555)))
    is_production = os.environ.get('FLASK_ENV') == 'production'
    app.run(debug=not is_production, port=port, host='0.0.0.0' if is_production else '127.0.0.1')
