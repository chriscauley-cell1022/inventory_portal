import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import re
from openpyxl import load_workbook
from models import db, InventorySnapshot, MetricSnapshot, SupplierMetric, DeliveryVariance

def extract_report_date_from_filename(filename):
    """Extract date from filename like 'Orebro Inventory Report_DWM-Taulia 080825.xlsx'"""
    match = re.search(r'(\d{6})', filename)
    if match:
        date_str = match.group(1)
        try:
            return datetime.strptime(date_str, '%m%d%y').date()
        except ValueError:
            pass
    return None

def parse_inventory_file(file_path):
    """Parse inventory Excel file and return DataFrame with report_date"""
    try:
        wb = load_workbook(file_path, data_only=True)
        sheet = wb['Inventory Report']

        # Find header row
        header_row = None
        for row_idx in range(1, 50):
            row = [cell.value for cell in sheet[row_idx]]
            if any(v == 'Purchase Order ' for v in row):
                header_row = row_idx
                break

        if not header_row:
            return None, None

        # Read data starting from header
        df = pd.read_excel(file_path, sheet_name='Inventory Report', header=header_row-1)
        df.columns = df.columns.str.strip()

        # Extract report date
        report_date = extract_report_date_from_filename(file_path)
        if not report_date:
            report_date = datetime.now().date()

        return df, report_date

    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return None, None

def calculate_delivery_variance(expected_date, confirmed_date):
    """Calculate days variance (negative = early, positive = late)"""
    if not expected_date or not confirmed_date:
        return None
    try:
        if isinstance(expected_date, str):
            expected_date = pd.to_datetime(expected_date).date()
        if isinstance(confirmed_date, str):
            confirmed_date = pd.to_datetime(confirmed_date).date()

        return (confirmed_date - expected_date).days
    except:
        return None

def ingest_inventory_file(file_path, app):
    """Ingest a single inventory file and update database"""
    df, report_date = parse_inventory_file(file_path)

    if df is None:
        print(f"Could not parse {file_path}")
        return False

    print(f"Ingesting {file_path} with report_date {report_date}")

    with app.app_context():
        try:
            for idx, row in df.iterrows():
                po_val = row.get('Purchase Order', '')
                if pd.isna(po_val) or not po_val:
                    continue
                po_number = str(po_val).strip()
                if not po_number or po_number == 'nan' or po_number == 'NaT':
                    continue

                # Check if already exists
                existing = InventorySnapshot.query.filter_by(
                    report_date=report_date,
                    po_number=po_number
                ).first()

                if existing:
                    continue

                def safe_to_date(val):
                    if pd.isna(val) or not val:
                        return None
                    try:
                        return pd.to_datetime(val).date()
                    except:
                        return None

                def safe_to_float(val, default=0):
                    if pd.isna(val) or not val:
                        return default
                    try:
                        return float(val)
                    except:
                        return default

                snapshot = InventorySnapshot(
                    report_date=report_date,
                    po_number=po_number,
                    dwm_order_date=safe_to_date(row.get('DWM Order Date')),
                    supplier=str(row.get('Supplier', '')).strip(),
                    part_number=str(row.get('Part No.', '')).strip() if pd.notna(row.get('Part No.')) else None,
                    part_description=str(row.get('Part Description', '')).strip() if pd.notna(row.get('Part Description')) else None,
                    confirmed_supplier_ship_date=safe_to_date(row.get('Confirmed Supplier Ship Date')),
                    expected_delivery_date=safe_to_date(row.get('Expected Delivery Date & Actual Delivery Date to DWM Warehouse')),
                    po_quantity=safe_to_float(row.get('PO Quantity')),
                    total_po_amount=safe_to_float(row.get('Total PO Amount')),
                    qty_on_order=safe_to_float(row.get('DWM Qty On Order')),
                    qty_in_transit=safe_to_float(row.get('DWM Qty In Transit')),
                    qty_on_hand=safe_to_float(row.get('DWM Qty On Hand')),
                    qty_called_off_delivered=safe_to_float(row.get('DWM Qty Called Off (Delivered)')),
                    qty_called_off_committed=safe_to_float(row.get('DWM Qty Called Off (Committed)')),
                )

                db.session.add(snapshot)

            db.session.commit()

            # Recalculate metrics for this date
            calculate_metrics(report_date, app)

            return True

        except Exception as e:
            db.session.rollback()
            print(f"Error ingesting data: {e}")
            return False

def calculate_metrics(report_date, app):
    """Calculate aggregated metrics for a given date"""
    with app.app_context():
        # Get all snapshots for this date
        snapshots = InventorySnapshot.query.filter_by(report_date=report_date).all()

        if not snapshots:
            return

        # Aggregate totals
        total_po_spend = sum(s.total_po_amount or 0 for s in snapshots)
        total_po_quantity = sum(s.po_quantity or 0 for s in snapshots)
        total_qty_on_order = sum(s.qty_on_order or 0 for s in snapshots)
        total_qty_in_transit = sum(s.qty_in_transit or 0 for s in snapshots)
        total_qty_on_hand = sum(s.qty_on_hand or 0 for s in snapshots)
        total_qty_called_off = sum((s.qty_called_off_delivered or 0) + (s.qty_called_off_committed or 0) for s in snapshots)

        # Get previous week and month data
        prev_week_date = report_date - timedelta(days=7)
        prev_month_date = report_date - timedelta(days=30)

        prev_week_snapshots = InventorySnapshot.query.filter_by(report_date=prev_week_date).all()
        prev_month_snapshots = InventorySnapshot.query.filter_by(report_date=prev_month_date).all()

        # Calculate WoW metrics
        wow_spend_change = None
        wow_spend_pct_change = None
        wow_quantity_change = None
        wow_quantity_pct_change = None

        if prev_week_snapshots:
            prev_spend = sum(s.total_po_amount or 0 for s in prev_week_snapshots)
            prev_qty = sum(s.po_quantity or 0 for s in prev_week_snapshots)

            if prev_spend > 0:
                wow_spend_change = total_po_spend - prev_spend
                wow_spend_pct_change = (wow_spend_change / prev_spend) * 100
            if prev_qty > 0:
                wow_quantity_change = total_po_quantity - prev_qty
                wow_quantity_pct_change = (wow_quantity_change / prev_qty) * 100

        # Calculate MoM metrics
        mom_spend_change = None
        mom_spend_pct_change = None
        mom_quantity_change = None
        mom_quantity_pct_change = None

        if prev_month_snapshots:
            prev_spend = sum(s.total_po_amount or 0 for s in prev_month_snapshots)
            prev_qty = sum(s.po_quantity or 0 for s in prev_month_snapshots)

            if prev_spend > 0:
                mom_spend_change = total_po_spend - prev_spend
                mom_spend_pct_change = (mom_spend_change / prev_spend) * 100
            if prev_qty > 0:
                mom_quantity_change = total_po_quantity - prev_qty
                mom_quantity_pct_change = (mom_quantity_change / prev_qty) * 100

        # Delete existing metric for this date
        MetricSnapshot.query.filter_by(snapshot_date=report_date).delete()

        metric = MetricSnapshot(
            snapshot_date=report_date,
            total_po_spend=total_po_spend,
            total_po_quantity=total_po_quantity,
            total_qty_on_order=total_qty_on_order,
            total_qty_in_transit=total_qty_in_transit,
            total_qty_on_hand=total_qty_on_hand,
            total_qty_called_off=total_qty_called_off,
            wow_spend_change=wow_spend_change,
            wow_spend_pct_change=wow_spend_pct_change,
            wow_quantity_change=wow_quantity_change,
            wow_quantity_pct_change=wow_quantity_pct_change,
            mom_spend_change=mom_spend_change,
            mom_spend_pct_change=mom_spend_pct_change,
            mom_quantity_change=mom_quantity_change,
            mom_quantity_pct_change=mom_quantity_pct_change,
        )

        db.session.add(metric)

        # Calculate supplier metrics
        suppliers = set(s.supplier for s in snapshots if s.supplier)

        for supplier in suppliers:
            supplier_snapshots = [s for s in snapshots if s.supplier == supplier]

            supplier_spend = sum(s.total_po_amount or 0 for s in supplier_snapshots)
            supplier_qty = sum(s.po_quantity or 0 for s in supplier_snapshots)
            supplier_qty_on_order = sum(s.qty_on_order or 0 for s in supplier_snapshots)
            supplier_qty_in_transit = sum(s.qty_in_transit or 0 for s in supplier_snapshots)
            supplier_qty_on_hand = sum(s.qty_on_hand or 0 for s in supplier_snapshots)
            supplier_qty_called_off = sum((s.qty_called_off_delivered or 0) + (s.qty_called_off_committed or 0) for s in supplier_snapshots)

            # Calculate average delivery variance
            variances = [
                calculate_delivery_variance(s.expected_delivery_date, s.confirmed_supplier_ship_date)
                for s in supplier_snapshots
            ]
            variances = [v for v in variances if v is not None]
            avg_variance = sum(variances) / len(variances) if variances else 0

            # Delete existing supplier metric for this date/supplier
            SupplierMetric.query.filter_by(snapshot_date=report_date, supplier=supplier).delete()

            supplier_metric = SupplierMetric(
                snapshot_date=report_date,
                supplier=supplier,
                total_po_spend=supplier_spend,
                total_po_quantity=supplier_qty,
                total_qty_on_order=supplier_qty_on_order,
                total_qty_in_transit=supplier_qty_in_transit,
                total_qty_on_hand=supplier_qty_on_hand,
                total_qty_called_off=supplier_qty_called_off,
                avg_delivery_variance_days=avg_variance,
                po_count=len(supplier_snapshots),
            )

            db.session.add(supplier_metric)

        db.session.commit()

def ingest_all_files(app, folder_path):
    """Ingest all inventory files from folder"""
    inventory_files = list(Path(folder_path).glob('**/*.xlsx'))
    inventory_files = [f for f in inventory_files if 'Inventory Report' in f.name or 'Inventory as of' in f.name]

    for file_path in sorted(inventory_files):
        ingest_inventory_file(str(file_path), app)

    print(f"Finished ingesting {len(inventory_files)} files")
