import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import re
import shutil
import json
from openpyxl import load_workbook
from models import db, InventorySnapshot, MetricSnapshot, SupplierMetric, DeliveryVariance, BaselineLeadTime
from sqlalchemy import func

# Currency conversion rates (as of 2026)
SEK_TO_EUR = 0.0945  # Approximate conversion rate

def backup_baseline_lead_times(basedir):
    """Backup BaselineLeadTime data to JSON file"""
    baseline_backup_path = os.path.join(basedir, '.baseline_lead_times.json')
    try:
        baseline_records = BaselineLeadTime.query.all()
        data = [
            {
                'supplier': r.supplier,
                'part_number': r.part_number,
                'manufacturing_lead_time_days': r.manufacturing_lead_time_days,
                'transit_lead_time_days': r.transit_lead_time_days,
                'total_lead_time_days': r.total_lead_time_days
            }
            for r in baseline_records
        ]
        with open(baseline_backup_path, 'w') as f:
            json.dump(data, f)
        if data:
            print(f"✓ Backed up {len(data)} baseline lead time records")
        return True
    except Exception as e:
        print(f"Note: Could not backup baseline data: {e}")
        return False

def restore_baseline_lead_times(basedir):
    """Restore BaselineLeadTime data from JSON backup"""
    baseline_backup_path = os.path.join(basedir, '.baseline_lead_times.json')
    if not os.path.exists(baseline_backup_path):
        return False

    try:
        with open(baseline_backup_path, 'r') as f:
            data = json.load(f)

        restored_count = 0
        for record in data:
            # Check if record already exists (avoid duplicates)
            existing = BaselineLeadTime.query.filter_by(
                supplier=record['supplier'],
                part_number=record['part_number']
            ).first()

            if not existing:
                baseline = BaselineLeadTime(
                    supplier=record['supplier'],
                    part_number=record['part_number'],
                    manufacturing_lead_time_days=record.get('manufacturing_lead_time_days'),
                    transit_lead_time_days=record.get('transit_lead_time_days'),
                    total_lead_time_days=record.get('total_lead_time_days')
                )
                db.session.add(baseline)
                restored_count += 1

        if restored_count > 0:
            db.session.commit()
            print(f"✓ Restored {restored_count} baseline lead time records from backup")
        else:
            print("✓ No new baseline records to restore (already in database)")
        return True
    except Exception as e:
        print(f"Note: Could not restore baseline data: {e}")
        return False

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
        # Also strip whitespace from all cell values (use map for newer pandas, applymap for older)
        try:
            df = df.map(lambda x: x.strip() if isinstance(x, str) else x, na_action='ignore')
        except (AttributeError, TypeError):
            df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x, na_action='ignore')

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
    try:
        df, report_date = parse_inventory_file(file_path)
        if df is None or report_date is None:
            print(f"ERROR: Failed to parse {file_path}")
            return False

        print(f"Ingesting {file_path} with report_date {report_date}")

        def safe_to_date(val):
            if pd.isna(val) or not val:
                return None
            try:
                return pd.to_datetime(val, format='%d-%b-%y').date()
            except:
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

        with app.app_context():
            # Clear existing inventory data only for this specific date (preserves historical metrics)
            print(f"Clearing inventory data for {report_date}...")
            InventorySnapshot.query.filter_by(report_date=report_date).delete()
            db.session.commit()
            print(f"Cleared inventory data for {report_date}")

            # Ingest new data - skip duplicate POs
            row_count = 0
            seen_pos = set()
            for idx, row in df.iterrows():
                po_val = row.get('Purchase Order', '')
                if pd.isna(po_val) or not po_val:
                    continue
                po_number = str(po_val).strip()
                if not po_number or po_number == 'nan':
                    continue

                # Skip if we've already added this PO in this ingest
                if po_number in seen_pos:
                    continue
                seen_pos.add(po_number)

                actual_delivery_date = safe_to_date(row.get('Expected Delivery Date & Actual Delivery Date to DWM Warehouse'))
                final_delivery_date = safe_to_date(row.get('Final Delivery Date'))
                dwm_order_date = safe_to_date(row.get('DWM Order Date'))

                days_remaining = None
                inventory_age = None
                if final_delivery_date:
                    days_remaining = (final_delivery_date - report_date).days
                    # Inventory age is 365 days minus days remaining (assumes 365-day shelf life)
                    inventory_age = 365 - days_remaining

                snapshot = InventorySnapshot(
                    report_date=report_date,
                    po_number=po_number,
                    dwm_order_date=dwm_order_date,
                    supplier=str(row.get('Supplier', '')).strip(),
                    part_number=str(row.get('Part No.', '')).strip() if pd.notna(row.get('Part No.')) else None,
                    part_description=str(row.get('Part Description', '')).strip() if pd.notna(row.get('Part Description')) else None,
                    confirmed_supplier_ship_date=safe_to_date(row.get('PO Ship Date')),
                    expected_delivery_date=safe_to_date(row.get('Confirmed Supplier Ship Date')),
                    actual_delivery_date=actual_delivery_date,
                    final_delivery_date=final_delivery_date,
                    days_remaining=days_remaining,
                    inventory_age=inventory_age,
                    po_quantity=safe_to_float(row.get('PO Quantity')),
                    total_po_amount=convert_currency(row.get('Total PO Amount'), row.get('Currency', 'EUR')),
                    qty_on_order=safe_to_float(row.get('DWM Qty On Order')),
                    qty_in_transit=safe_to_float(row.get('DWM Qty In Transit')),
                    qty_on_hand=safe_to_float(row.get('DWM Qty On Hand')),
                    qty_called_off_delivered=safe_to_float(row.get('DWM Qty Called Off (Delivered)')),
                    qty_called_off_committed=safe_to_float(row.get('DWM Qty Called Off (Committed)')),
                    currency='EUR',
                    warehouse=str(row.get('Warehouse', '')).strip().upper() if pd.notna(row.get('Warehouse')) else None,
                )
                db.session.add(snapshot)
                row_count += 1

                # Batch commit every 100 rows
                if row_count % 100 == 0:
                    db.session.commit()
                    print(f"Batch committed: {row_count} rows")

            db.session.commit()
            print(f"Completed ingest: {row_count} total rows")
            calculate_metrics(report_date, app)
            return True

    except Exception as e:
        print(f"ERROR ingest_inventory_file: {e}")
        import traceback
        traceback.print_exc()
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
        total_po_quantity = sum(s.po_quantity or 0 for s in snapshots)
        total_qty_on_order = sum(s.qty_on_order or 0 for s in snapshots)
        total_qty_in_transit = sum(s.qty_in_transit or 0 for s in snapshots)
        total_qty_on_hand = sum(s.qty_on_hand or 0 for s in snapshots)
        total_qty_open = total_qty_on_order + total_qty_in_transit + total_qty_on_hand
        # Called-off = original PO quantity minus remaining open quantities
        total_qty_called_off = max(0, total_po_quantity - total_qty_open)

        # Calculate total_po_spend excluding called-off amounts
        # Only apply proportional calculation for pre-31 May files (old format with one row per PO)
        # Post-31 May files already exclude called-off because they have one row per unit
        use_proportional = report_date <= datetime.strptime('2026-05-31', '%Y-%m-%d').date()

        total_po_spend = 0
        for s in snapshots:
            if s.po_quantity and s.po_quantity > 0:
                if use_proportional:
                    # Old format: apply proportional calculation
                    open_qty = (s.qty_on_order or 0) + (s.qty_in_transit or 0) + (s.qty_on_hand or 0)
                    if open_qty > 0:
                        proportional_amount = (open_qty / s.po_quantity) * (s.total_po_amount or 0)
                    else:
                        proportional_amount = 0
                    total_po_spend += proportional_amount
                else:
                    # New format: use full amount (called-off already excluded)
                    total_po_spend += (s.total_po_amount or 0)

        # Get previous week data
        prev_week_date = report_date - timedelta(days=7)
        prev_week_snapshots = InventorySnapshot.query.filter_by(report_date=prev_week_date).all()

        # Calculate WoW metrics
        wow_spend_change = None
        wow_spend_pct_change = None
        wow_quantity_change = None
        wow_quantity_pct_change = None

        if prev_week_snapshots:
            # Calculate previous week spend excluding called-off (same logic as current week)
            prev_use_proportional = prev_week_date <= datetime.strptime('2026-05-31', '%Y-%m-%d').date()
            prev_spend = 0
            for s in prev_week_snapshots:
                if s.po_quantity and s.po_quantity > 0:
                    if prev_use_proportional:
                        open_qty = (s.qty_on_order or 0) + (s.qty_in_transit or 0) + (s.qty_on_hand or 0)
                        if open_qty > 0:
                            proportional_amount = (open_qty / s.po_quantity) * (s.total_po_amount or 0)
                        else:
                            proportional_amount = 0
                        prev_spend += proportional_amount
                    else:
                        prev_spend += (s.total_po_amount or 0)

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
            # Calculate previous month spend excluding called-off (same logic as current week)
            prev_use_proportional = prev_month_date <= datetime.strptime('2026-05-31', '%Y-%m-%d').date()
            prev_spend = 0
            for s in prev_month_snapshots:
                if s.po_quantity and s.po_quantity > 0:
                    if prev_use_proportional:
                        open_qty = (s.qty_on_order or 0) + (s.qty_in_transit or 0) + (s.qty_on_hand or 0)
                        if open_qty > 0:
                            proportional_amount = (open_qty / s.po_quantity) * (s.total_po_amount or 0)
                        else:
                            proportional_amount = 0
                        prev_spend += proportional_amount
                    else:
                        prev_spend += (s.total_po_amount or 0)

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

        # Calculate spend by status (sum of qty * unit_price for each item)
        spend_on_order = 0
        spend_in_transit = 0
        spend_on_hand = 0
        for item in inventory:
            if item.po_quantity and item.po_quantity > 0:
                unit_price = item.total_po_amount / item.po_quantity
                spend_on_order += (item.qty_on_order or 0) * unit_price
                spend_in_transit += (item.qty_in_transit or 0) * unit_price
                spend_on_hand += (item.qty_on_hand or 0) * unit_price

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

            supplier_total_po_spend = sum(s.total_po_amount or 0 for s in supplier_snapshots)
            supplier_qty = sum(s.po_quantity or 0 for s in supplier_snapshots)
            supplier_qty_on_order = sum(s.qty_on_order or 0 for s in supplier_snapshots)
            supplier_qty_in_transit = sum(s.qty_in_transit or 0 for s in supplier_snapshots)
            supplier_qty_on_hand = sum(s.qty_on_hand or 0 for s in supplier_snapshots)

            # Calculate open spend (only on order, in transit, on hand - exclude called-off)
            supplier_open_qty = supplier_qty_on_order + supplier_qty_in_transit + supplier_qty_on_hand
            if supplier_qty > 0:
                supplier_spend = (supplier_open_qty / supplier_qty) * supplier_total_po_spend
            else:
                supplier_spend = 0

            supplier_qty_called_off = sum(s.qty_called_off_delivered or 0 for s in supplier_snapshots) + sum(s.qty_called_off_committed or 0 for s in supplier_snapshots)

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
            wow_spend_pct = None
            wow_qty = None
            wow_qty_pct = None

            if prev_supplier_snapshots:
                # Calculate previous week's open spend (same logic as current week)
                prev_supplier_total_po_spend = sum(s.total_po_amount or 0 for s in prev_supplier_snapshots)
                prev_supplier_qty = sum(s.po_quantity or 0 for s in prev_supplier_snapshots)
                prev_supplier_open_qty = (sum(s.qty_on_order or 0 for s in prev_supplier_snapshots) +
                                         sum(s.qty_in_transit or 0 for s in prev_supplier_snapshots) +
                                         sum(s.qty_on_hand or 0 for s in prev_supplier_snapshots))
                if prev_supplier_qty > 0:
                    prev_supplier_spend = (prev_supplier_open_qty / prev_supplier_qty) * prev_supplier_total_po_spend
                else:
                    prev_supplier_spend = 0

                wow_spend = supplier_spend - prev_supplier_spend
                if prev_supplier_spend > 0:
                    wow_spend_pct = (wow_spend / prev_supplier_spend) * 100

                wow_qty = supplier_qty - prev_supplier_qty
                if prev_supplier_qty > 0:
                    wow_qty_pct = (wow_qty / prev_supplier_qty) * 100

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
                wow_spend_pct_change=wow_spend_pct,
                wow_qty_change=wow_qty,
                wow_qty_pct_change=wow_qty_pct,
            )

            db.session.add(supplier_metric)

        db.session.commit()

def ingest_all_files(app, folder_path, clear_latest=False):
    """Ingest all inventory files from folder or Google Drive (only new files since last ingest)"""
    try:
        # Try to download from Google Drive first (optional dependency)
        inventory_files = None
        try:
            from google_drive_integration import download_latest_inventory_file, get_folder_id
            import tempfile

            temp_dir = tempfile.gettempdir()
            gdrive_file = download_latest_inventory_file(get_folder_id(), temp_dir)

            if gdrive_file:
                print(f"Using file from Google Drive: {gdrive_file}")
                inventory_files = [Path(gdrive_file)]
        except ImportError:
            print("Google Drive dependencies not available. Falling back to local folder.")
        except Exception as e:
            print(f"Google Drive download failed: {e}. Falling back to local folder.")

        # Fall back to local folder if Google Drive didn't work
        if not inventory_files:
            print("Reading from local folder: " + folder_path)
            inventory_files = list(Path(folder_path).glob('**/*.xlsx'))
            inventory_files = [f for f in inventory_files if 'Inventory' in f.name and not f.name.startswith('~$')]

        # Sort by filename (works with YYYY-MM-DD_ prefix format)
        inventory_files = sorted(inventory_files)

        basedir = os.path.abspath(os.path.dirname(__file__))

        with app.app_context():
            if clear_latest:
                # Backup BaselineLeadTime data before clearing
                backup_baseline_lead_times(basedir)

                # Delete inventory records from the most recent date to force re-ingest
                # (keep metrics for historical charting)
                latest_date = db.session.query(func.max(InventorySnapshot.report_date)).scalar()
                if latest_date:
                    print(f"Clearing inventory data for {latest_date} to re-ingest...")
                    InventorySnapshot.query.filter_by(report_date=latest_date).delete()
                    DeliveryVariance.query.filter_by(report_date=latest_date).delete()
                    # NOTE: NOT deleting MetricSnapshot/SupplierMetric - preserve for historical trends
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
        # Process all files to build historical metrics for charts
        if inventory_files:
            sorted_files = sorted(inventory_files)
            print(f"Found {len(sorted_files)} inventory files")
            for f in sorted_files[-5:]:  # Show last 5 files
                print(f"  - {f.name}")
            print(f"Processing all {len(sorted_files)} files to build historical data...")
            for file_path in sorted_files:
                if ingest_inventory_file(str(file_path), app):
                    ingested_count += 1
                    print(f"  ✓ Ingested {file_path.name}")
        else:
            print("ERROR: No inventory files found!")

        print(f"Finished ingesting {ingested_count} files")

        # Restore BaselineLeadTime data if it was backed up
        with app.app_context():
            restore_baseline_lead_times(basedir)

        # Populate missing warehouse dates after successful ingest
        if ingested_count > 0:
            with app.app_context():
                updated = InventorySnapshot.query.filter(
                    InventorySnapshot.actual_delivery_date == None,
                    InventorySnapshot.expected_delivery_date != None
                ).update({
                    InventorySnapshot.actual_delivery_date: InventorySnapshot.expected_delivery_date
                })
                db.session.commit()
                print(f"✓ Populated {updated} missing warehouse dates with expected delivery dates")

        # Create backup after successful ingest
        if ingested_count > 0:
            backup_database(app)

        return True

    except Exception as e:
        print(f"Error in ingest_all_files: {e}")
        import traceback
        traceback.print_exc()
        return False
