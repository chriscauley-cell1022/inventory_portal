"""Google Drive API integration for downloading inventory files"""
import os
import json
import tempfile
from pathlib import Path
from datetime import datetime

def download_latest_inventory_file(folder_id, output_dir=None):
    """
    Download the latest Excel inventory file from Google Drive folder.

    Args:
        folder_id: Google Drive folder ID (e.g., "1VOycR0bEMSctK8ykYf7SFJT7uT5uD1EK")
        output_dir: Directory to save the file. If None, uses system temp directory.

    Returns:
        Path to downloaded file, or None if download failed
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
        import io

        # Get credentials from environment variable
        creds_json = os.environ.get('GOOGLE_DRIVE_CREDENTIALS')
        if not creds_json:
            print("ERROR: GOOGLE_DRIVE_CREDENTIALS environment variable not set")
            return None

        # Parse credentials
        try:
            creds_dict = json.loads(creds_json)
        except json.JSONDecodeError:
            print("ERROR: GOOGLE_DRIVE_CREDENTIALS is not valid JSON")
            return None

        # Create service account credentials
        credentials = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )

        # Build Drive service
        drive_service = build('drive', 'v3', credentials=credentials)

        # Query for Excel files in the folder, sorted by modified time (newest first)
        query = f"'{folder_id}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false"

        results = drive_service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, modifiedTime)',
            orderBy='modifiedTime desc',
            pageSize=1
        ).execute()

        files = results.get('files', [])
        if not files:
            print("ERROR: No Excel files found in Google Drive folder")
            return None

        latest_file = files[0]
        file_name = latest_file['name']
        file_id = latest_file['id']

        print(f"Found latest file: {file_name}")

        # Download the file
        if output_dir is None:
            output_dir = tempfile.gettempdir()
        else:
            os.makedirs(output_dir, exist_ok=True)

        output_path = Path(output_dir) / file_name

        # Download using MediaIoBaseDownload
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.FileIO(str(output_path), 'wb')
        downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)

        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                print(f"Download progress: {int(status.progress() * 100)}%")

        fh.close()

        print(f"Downloaded to: {output_path}")
        return str(output_path)

    except ImportError:
        print("ERROR: google-auth-oauthlib not installed. Install with: pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client")
        return None
    except Exception as e:
        print(f"ERROR downloading from Google Drive: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_folder_id():
    """Get the Google Drive folder ID from environment or return the default"""
    return os.environ.get('GOOGLE_DRIVE_FOLDER_ID', '1VOycR0bEMSctK8ykYf7SFJT7uT5uD1EK')
