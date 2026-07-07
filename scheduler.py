import schedule
import time
import logging
from datetime import datetime
from app import app
from ingest import ingest_all_files

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INVENTORY_FOLDER = "/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD"

def ingest_job():
    """Job to run weekly data ingestion"""
    logger.info(f"Starting scheduled ingestion at {datetime.now()}")
    try:
        with app.app_context():
            ingest_all_files(app, INVENTORY_FOLDER)
        logger.info("Ingestion completed successfully")
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")

def schedule_weekly_ingest():
    """Schedule ingestion to run every Friday at 9 AM"""
    schedule.every().friday.at("09:00").do(ingest_job)
    logger.info("Scheduled weekly ingestion for Fridays at 9:00 AM")

def run_scheduler():
    """Run the scheduler loop"""
    schedule_weekly_ingest()

    logger.info("Scheduler started. Press Ctrl+C to exit.")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == '__main__':
    run_scheduler()
