import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import re
import shutil
from openpyxl import load_workbook
from models import db, InventorySnapshot, MetricSnapshot, SupplierMetric, DeliveryVariance
from sqlalchemy import func

# Currency conversion rates (as of 2026)
SEK_TO_EUR = 0.0945  # Approximate conversion rate

def backup_database(app):
    """Create a timestamped backup of the current database"""
    basedir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(basedir, 'inventory.db')
    backup_dir = os.path.join(basedir, 'databases')

    os.makedirs(backup_dir, exist_ok=True)

    # Get latest snapshot date for backup filename
    with app.app_context():
        from sqlalchemy import func
        latest_date = db.session.query(func.max(SupplierMetric.snapshot_date)).scalar()
        if latest_date:
            backup_filename = f'inventory_{latest_date}.db'
            backup_path = os.path.join(backup_dir, backup_filename)

            # Create backup
            if os.path.exists(db_path):
                shutil.copy2(db_path, backup_path)
                print(f"✓ Database backup created: {backup_filename}")

                # Also export metrics to Excel
                try:
                    supplier_metrics = pd.read_sql_query(
                        "SELECT * FROM supplier_metric WHERE snapshot_date = ?",
                        f'sqlite:///{db_path}',
                        params=(latest_date,)
                    )
                    inventory_data = pd.read_sql_query(
                        "SELECT * FROM inventory_snapshot WHERE report_date = ?",
                        f'sqlite:///{db_path}',
                        params=(latest_date,)
                    )

                    excel_filename = f'supplier_metrics_{latest_date}.xlsx'
                    excel_path = os.path.join(backup_dir, excel_filename)

                    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                        supplier_metrics.to_excel(writer, sheet_name='Supplier Metrics', index=False)
                        inventory_data.to_excel(writer, sheet_name='Inventory Details', index=False)

                    print(f"✓ Metrics exported: {excel_filename}")
                except Exception as e:
                    print(f"Warning: Could not export Excel: {e}")

def extract_report_date_from_filename(filename):
    """Extract date from filename"""
    # Try "as of Month DD, YYYY" format (e.g., "as of February 13, 2026")
    match = re.search(r'as of\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})', filename)
    if match:
        try:
            month_str = match.group(1)
            day = match.group(2)
            year = match.group(3)
            date_str = f"{month_str} {day} {year}"
            date = datetime.strptime(date_str, '%B %d %Y').date()
            if date.year >= 2026:
                return date
        except ValueError:
            pass

    # Try MMDDYY format (e.g., "080825" for Aug 8, 2025)
    match = re.search(r'(\d{6})', filename)
    if match:
        date_str = match.group(1)
        try:
            date = datetime.strptime(date_str, '%m%d%y').date()
            if date.year >= 2026:
                return date
        except ValueError:
            pass

    # Try YYYY-MM-DD format
    match = re.search(r'(\d{4})-(\d{2})-(\d{2})', filename)
    if match:
        try:
            date = datetime.strptime(match.group(0), '%Y-%m-%d').date()
            if date.year >= 2026:
                return date
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
            if any(v == 'Purchase Order ' for v in row) or any(v == 'Purchase Order' for v in row):
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
            return None, None

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

def convert_currency(amount, currency_str):
    """Convert currency to EUR. Assumes amounts are in EUR or SEK based on currency_str"""
    if not amount or pd.isna(amount):
        return 0.0

    try:
        amount = float(amount)
        if amount == 0:
            return 0.0

        # Check if currency indicates SEK
        if currency_str and isinstance(currency_str, str):
            if 'SEK' in currency_str.upper():
                return amount * SEK_TO_EUR

        # Default to EUR
        return amount
    except:
        return 0.0

def ingest_inventory_file(file_path, app):
    """Ingest a single inventory file and update database"""
    df, report_date = parse_inventory_file(file_path)

    if df is None or report_date is None:
        return False

    print(f"Ingesting {file_path} with report_date {report_date}")

    with app.app_context():
        try:
            # Define date/float conversion functions
            def safe_to_date(val):
                if pd.isna(val) or not val:
                    return None
                try:
                    # Try multiple date formats
                    # First try the DD-Mon-YY format (e.g., "10-Apr-26")
                    try:
                        return pd.to_datetime(val, format='%d-%b-%y').date()
                    except:
                        # Fall back to pandas auto-detection
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

            # Load all existing PO numbers for this date once (much faster than per-row queries)
            existing_pos = set(
                row[0] for row in InventorySnapshot.query.filter_by(
                    report_date=report_date
                ).with_entities(InventorySnapshot.po_number).all()
            )

            for idx, row in df.iterrows():
                po_val = row.get('Purchase Order', '')
                if pd.isna(po_val) or not po_val:
                    continue
                po_number = str(po_val).strip()
                if not po_number or po_number == 'nan' or po_number == 'NaT':
                    continue

                # Check if already exists using the set (O(1) lookup)
                if po_number in existing_pos:
                    # Update existing record with warehouse receipt date if missing
                    existing_record = InventorySnapshot.query.filter_by(
                        report_date=report_date,
                        po_number=po_number
                    ).first()

                    if existing_record and not existing_record.actual_delivery_date:
                        qty_on_hand = safe_to_float(row.get('DWM Qty On Hand', 0))
                        if qty_on_hand > 0:
                            existing_record.actual_delivery_date = safe_to_date(row.get('Expected Delivery Date & Actual Delivery Date to DWM Warehouse'))
                            db.session.commit()
                    continue

                # Get currency column if it exists
                currency_str = row.get('Currency', 'EUR')

                # Calculate days remaining to expiration
                final_delivery_date = safe_to_date(row.get('Final Delivery Date'))
                inventory_age_val = None
                days_remaining_val = None

                if final_delivery_date:
                    days_remaining_val = (final_delivery_date - report_date).days

                # Try to get inventory age
                try:
                    inv_age = row.get('Inventory Age')
                    if pd.notna(inv_age):
                        inventory_age_val = int(inv_age)
                except:
                    pass

                # Always populate actual delivery date from source if available
                actual_delivery_date = safe_to_date(row.get('Expected Delivery Date & Actual Delivery Date to DWM Warehouse'))

                snapshot = InventorySnapshot(
                    report_date=report_date,
                    po_number=po_number,
                    dwm_order_date=safe_to_date(row.get('DWM Order Date')),
                    supplier=str(row.get('Supplier', '')).strip(),
                    part_number=str(row.get('Part No.', '')).strip() if pd.notna(row.get('Part No.')) else None,
                    part_description=str(row.get('Part Description', '')).strip() if pd.notna(row.get('Part Description')) else None,
                    confirmed_supplier_ship_date=safe_to_date(row.get('Confirmed Supplier Ship Date')),
                    expected_delivery_date=safe_to_date(row.get('Expected Delivery Date & Actual Delivery Date to DWM Warehouse')),
                    actual_delivery_date=actual_delivery_date,
                    final_delivery_date=final_delivery_date,
                    inventory_age=inventory_age_val,
                    days_remaining=days_remaining_val,
                    po_quantity=safe_to_float(row.get('PO Quantity')),
                    total_po_amount=convert_currency(row.get('Total PO Amount'), currency_str),
                    qty_on_order=safe_to_float(row.get('DWM Qty On Order')),
                    qty_in_transit=safe_to_float(row.get('DWM Qty In Transit')),
                    qty_on_hand=safe_to_float(row.get('DWM Qty On Hand')),
                    qty_called_off_delivered=safe_to_float(row.get('DWM Qty Called Off (Delivered)')),
                    qty_called_off_committed=safe_to_float(row.get('DWM Qty Called Off (Committed)')),
                    currency='EUR',
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
        # Get all snapshots for this date with PO quantity > 0
        snapshots = InventorySnapshot.query.filter_by(report_date=report_date).all()
        # Filter to only include records with PO quantity > 0
        snapshots = [s for s in snapshots if s.po_quantity and s.po_quantity > 0]

        if not snapshots:
            return

        # Aggregate totals (not cumulative - just this week's snapshot)
        # Only count POs with quantity > 0
        total_po_spend = sum(s.total_po_amount or 0 for s in snapshots)
        total_po_quantity = sum(s.po_quantity or 0 for s in snapshots)
        total_qty_on_order = sum(s.qty_on_order or 0 for s in snapshots)
        total_qty_in_transit = sum(s.qty_in_transit or 0 for s in snapshots)
        total_qty_on_hand = sum(s.qty_on_hand or 0 for s in snapshots)
        # Called-off = original PO quantity minus remaining open quantities
        total_qty_called_off = max(0, total_po_quantity - (total_qty_on_order + total_qty_in_transit + total_qty_on_hand))

        # Get previous week data
        prev_week_date = report_date - timedelta(days=7)
        prev_week_snapshots = InventorySnapshot.query.filter_by(report_date=prev_week_date).all()

        # Calculate WoW metrics
        wow_spend_change = None
        wow_spend_pct_change = None
        wow_quantity_change = None
        wow_quantity_pct_change = None

        if prev_week_snapshots:
            prev_spend = sum(s.total_po_amount or 0 for s in prev_week_snapshots)
            prev_qty = sum(s.po_quantity or 0 for s in prev_week_snapshots)

            wow_spend_change = total_po_spend - prev_spend
            if prev_spend > 0:
                wow_spend_pct_change = (wow_spend_change / prev_spend) * 100

            wow_quantity_change = total_po_quantity - prev_qty
            if prev_qty > 0:
                wow_quantity_pct_change = (wow_quantity_change / prev_qty) * 100

        # Get previous month data
        prev_month_date = report_date - timedelta(days=30)
        prev_month_snapshots = InventorySnapshot.query.filter_by(report_date=prev_month_date).all()

        # Calculate MoM metrics
        mom_spend_change = None
        mom_spend_pct_change = None
        mom_quantity_change = None
        mom_quantity_pct_change = None

        if prev_month_snapshots:
            prev_spend = sum(s.total_po_amount or 0 for s in prev_month_snapshots)
            prev_qty = sum(s.po_quantity or 0 for s in prev_month_snapshots)

            mom_spend_change = total_po_spend - prev_spend
            if prev_spend > 0:
                mom_spend_pct_change = (mom_spend_change / prev_spend) * 100

            mom_quantity_change = total_po_quantity - prev_qty
            if prev_qty > 0:
                mom_quantity_pct_change = (mom_quantity_change / prev_qty) * 100

        # Calculate open PO spend (only on order, in transit, on hand)
        total_open_qty = total_qty_on_order + total_qty_in_transit + total_qty_on_hand
        if total_po_quantity > 0:
            open_po_spend = (total_open_qty / total_po_quantity) * total_po_spend
        else:
            open_po_spend = 0

        # Calculate spend by status
        if total_po_quantity > 0:
            spend_on_order = (total_qty_on_order / total_po_quantity) * total_po_spend
            spend_in_transit = (total_qty_in_transit / total_po_quantity) * total_po_spend
            spend_on_hand = (total_qty_on_hand / total_po_quantity) * total_po_spend
        else:
            spend_on_order = 0
            spend_in_transit = 0
            spend_on_hand = 0

        # Delete existing metric for this date
        MetricSnapshot.query.filter_by(snapshot_date=report_date).delete()

        metric = MetricSnapshot(
            snapshot_date=report_date,
            total_po_spend=total_po_spend,
            total_po_quantity=total_po_quantity,
            open_po_spend=open_po_spend,
            total_qty_on_order=total_qty_on_order,
            total_qty_in_transit=total_qty_in_transit,
            total_qty_on_hand=total_qty_on_hand,
            spend_on_order=spend_on_order,
            spend_in_transit=spend_in_transit,
            spend_on_hand=spend_on_hand,
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
            # Don't include called-off inventory
            supplier_qty_called_off = 0

            # Calculate average delivery variance
            variances = [
                calculate_delivery_variance(s.expected_delivery_date, s.confirmed_supplier_ship_date)
                for s in supplier_snapshots
            ]
            variances = [v for v in variances if v is not None]
            avg_variance = sum(variances) / len(variances) if variances else 0

            # Calculate WoW for this supplier
            prev_supplier_snapshots = [s for s in prev_week_snapshots if s.supplier == supplier] if prev_week_snapshots else []
            wow_spend = None
            wow_qty = None

            if prev_supplier_snapshots:
                prev_supplier_spend = sum(s.total_po_amount or 0 for s in prev_supplier_snapshots)
                prev_supplier_qty = sum(s.po_quantity or 0 for s in prev_supplier_snapshots)

                wow_spend = supplier_spend - prev_supplier_spend
                wow_qty = supplier_qty - prev_supplier_qty

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
                wow_spend_change=wow_spend,
                wow_qty_change=wow_qty,
            )

            db.session.add(supplier_metric)

        db.session.commit()

def ingest_all_files(app, folder_path, clear_latest=False):
    """Ingest all inventory files from folder (only new files since last ingest)"""
    try:
        inventory_files = list(Path(folder_path).glob('**/*.xlsx'))
        inventory_files = [f for f in inventory_files if 'Inventory Report' in f.name or 'Inventory as of' in f.name]

        # Sort by date
        inventory_files = sorted(inventory_files)

        with app.app_context():
            if clear_latest:
                # Delete records from the most recent date to force re-ingest
                latest_date = db.session.query(func.max(InventorySnapshot.report_date)).scalar()
                if latest_date:
                    print(f"Clearing data for {latest_date} to re-ingest...")
                    InventorySnapshot.query.filter_by(report_date=latest_date).delete()
                    MetricSnapshot.query.filter_by(snapshot_date=latest_date).delete()
                    SupplierMetric.query.filter_by(snapshot_date=latest_date).delete()
                    DeliveryVariance.query.filter_by(report_date=latest_date).delete()
                    db.session.commit()
                    existing_dates = set()
                else:
                    existing_dates = set()
            else:
                # Get all dates already in database
                existing_dates = set(
                    row[0] for row in InventorySnapshot.query.with_entities(
                        InventorySnapshot.report_date
                    ).distinct().all()
                )

        ingested_count = 0
        for file_path in inventory_files:
            report_date = extract_report_date_from_filename(file_path.name)

            # Skip if this date is already in database (unless we're clearing latest)
            if not clear_latest and report_date and report_date in existing_dates:
                print(f"Skipping {file_path.name} (already ingested)")
                continue

            if ingest_inventory_file(str(file_path), app):
                ingested_count += 1

        print(f"Finished ingesting {ingested_count} files")

        # Create backup after successful ingest
        if ingested_count > 0:
            backup_database(app)

        return True

    except Exception as e:
        print(f"Error in ingest_all_files: {e}")
        import traceback
        traceback.print_exc()
        return False
