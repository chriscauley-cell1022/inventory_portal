from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class InventorySnapshot(db.Model):
    __tablename__ = 'inventory_snapshot'

    id = db.Column(db.Integer, primary_key=True)
    report_date = db.Column(db.Date, nullable=False, index=True)
    po_number = db.Column(db.String(255), nullable=False, index=True)
    dwm_order_date = db.Column(db.Date)
    supplier = db.Column(db.String(255), nullable=False, index=True)
    part_number = db.Column(db.String(255))
    part_description = db.Column(db.String(512))
    confirmed_supplier_ship_date = db.Column(db.Date)
    expected_delivery_date = db.Column(db.Date)
    actual_delivery_date = db.Column(db.Date)
    final_delivery_date = db.Column(db.Date)
    inventory_age = db.Column(db.Integer)
    days_remaining = db.Column(db.Integer)
    po_quantity = db.Column(db.Float)
    total_po_amount = db.Column(db.Float)
    qty_on_order = db.Column(db.Float)
    qty_in_transit = db.Column(db.Float)
    qty_on_hand = db.Column(db.Float)
    qty_called_off_delivered = db.Column(db.Float)
    qty_called_off_committed = db.Column(db.Float)
    currency = db.Column(db.String(3), default='EUR')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('report_date', 'po_number', name='uq_snapshot_date_po'),
    )

class MetricSnapshot(db.Model):
    __tablename__ = 'metric_snapshot'

    id = db.Column(db.Integer, primary_key=True)
    snapshot_date = db.Column(db.Date, nullable=False, unique=True, index=True)
    total_po_spend = db.Column(db.Float)
    total_po_quantity = db.Column(db.Float)
    open_po_spend = db.Column(db.Float)
    total_qty_on_order = db.Column(db.Float)
    total_qty_in_transit = db.Column(db.Float)
    total_qty_on_hand = db.Column(db.Float)
    spend_on_order = db.Column(db.Float)
    spend_in_transit = db.Column(db.Float)
    spend_on_hand = db.Column(db.Float)
    wow_spend_change = db.Column(db.Float)
    wow_spend_pct_change = db.Column(db.Float)
    wow_quantity_change = db.Column(db.Float)
    wow_quantity_pct_change = db.Column(db.Float)
    mom_spend_change = db.Column(db.Float)
    mom_spend_pct_change = db.Column(db.Float)
    mom_quantity_change = db.Column(db.Float)
    mom_quantity_pct_change = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SupplierMetric(db.Model):
    __tablename__ = 'supplier_metric'

    id = db.Column(db.Integer, primary_key=True)
    snapshot_date = db.Column(db.Date, nullable=False, index=True)
    supplier = db.Column(db.String(255), nullable=False, index=True)
    total_po_spend = db.Column(db.Float)
    total_po_quantity = db.Column(db.Float)
    total_qty_on_order = db.Column(db.Float)
    total_qty_in_transit = db.Column(db.Float)
    total_qty_on_hand = db.Column(db.Float)
    total_qty_called_off = db.Column(db.Float)
    avg_delivery_variance_days = db.Column(db.Float)
    po_count = db.Column(db.Integer)
    wow_spend_change = db.Column(db.Float)
    wow_qty_change = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('snapshot_date', 'supplier', name='uq_supplier_date'),
    )

class DeliveryVariance(db.Model):
    __tablename__ = 'delivery_variance'

    id = db.Column(db.Integer, primary_key=True)
    report_date = db.Column(db.Date, nullable=False, index=True)
    po_number = db.Column(db.String(255), nullable=False)
    supplier = db.Column(db.String(255), nullable=False, index=True)
    expected_delivery_date = db.Column(db.Date)
    confirmed_supplier_ship_date = db.Column(db.Date)
    variance_days = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class BaselineLeadTime(db.Model):
    __tablename__ = 'baseline_lead_time'

    id = db.Column(db.Integer, primary_key=True)
    supplier = db.Column(db.String(255), nullable=False, index=True)
    part_number = db.Column(db.String(255), nullable=False, index=True)
    manufacturing_lead_time_days = db.Column(db.Integer)
    transit_lead_time_days = db.Column(db.Integer)
    total_lead_time_days = db.Column(db.Integer)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('supplier', 'part_number', name='uq_baseline_supplier_part'),
    )

class SupplierMapping(db.Model):
    __tablename__ = 'supplier_mapping'

    id = db.Column(db.Integer, primary_key=True)
    baseline_supplier_name = db.Column(db.String(255), nullable=False, unique=True, index=True)
    inventory_supplier_name = db.Column(db.String(255), nullable=False, index=True)
