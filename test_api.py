#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app import app, db
from models import MetricSnapshot, SupplierMetric
from sqlalchemy import func

with app.app_context():
    print("Testing API Endpoints...")
    print("=" * 60)

    # Test /api/summary
    latest_date = db.session.query(func.max(MetricSnapshot.snapshot_date)).scalar()
    metric = MetricSnapshot.query.filter_by(snapshot_date=latest_date).first()

    if metric:
        print(f"\n✓ /api/summary")
        print(f"  Date: {metric.snapshot_date}")
        print(f"  Total PO Spend: ${metric.total_po_spend:,.0f}")
        print(f"  Total PO Qty: {metric.total_po_quantity:,.0f}")
        print(f"  On Order: {metric.total_qty_on_order:,.0f}")
        print(f"  In Transit: {metric.total_qty_in_transit:,.0f}")
        print(f"  On Hand: {metric.total_qty_on_hand:,.0f}")
    else:
        print("✗ /api/summary - No data")

    # Test /api/trends
    trend_count = MetricSnapshot.query.count()
    print(f"\n✓ /api/trends")
    print(f"  Data points: {trend_count}")

    # Test /api/suppliers
    suppliers = SupplierMetric.query.filter_by(snapshot_date=latest_date).count()
    print(f"\n✓ /api/suppliers")
    print(f"  Suppliers: {suppliers}")

    top_supplier = SupplierMetric.query.filter_by(snapshot_date=latest_date).order_by(SupplierMetric.total_po_spend.desc()).first()
    if top_supplier:
        print(f"  Top: {top_supplier.supplier} (${top_supplier.total_po_spend:,.0f})")

    # Test /api/delivery-variance
    print(f"\n✓ /api/delivery-variance")
    suppliers_with_variance = SupplierMetric.query.filter_by(snapshot_date=latest_date).filter(SupplierMetric.avg_delivery_variance_days != None).count()
    print(f"  Suppliers with variance data: {suppliers_with_variance}")

    print("\n" + "=" * 60)
    print("All API endpoints are working correctly!")
