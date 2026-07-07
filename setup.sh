#!/bin/bash

set -e

echo "Setting up Inventory Portal..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -q -r requirements.txt

# Install Node dependencies
echo "Installing Node dependencies..."
cd frontend
npm install -q
cd ..

# Initialize database and ingest data
echo "Initializing database and ingesting data..."
python3 << 'EOF'
import sys
sys.path.insert(0, '.')

from app import app, db
from ingest import ingest_all_files

with app.app_context():
    db.create_all()
    folder_path = "/Users/chris.cauley/Google Drive/DWM Inventory Rpts/OrebroSRD"
    ingest_all_files(app, folder_path)

print("✓ Setup complete!")
EOF
