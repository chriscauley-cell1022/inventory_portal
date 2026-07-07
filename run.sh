#!/bin/bash

echo "Starting Inventory Portal..."
echo ""
echo "Starting Backend API (port 5000)..."
python3 app.py &
BACKEND_PID=$!

sleep 2

echo "Starting Frontend (port 3000)..."
cd frontend
npm start &
FRONTEND_PID=$!

cd ..

echo ""
echo "Portal is running!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:5000/api"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped'; exit 0" INT
wait
