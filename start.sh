#!/bin/bash
# RMS Production Startup Script
set -e
cd "$(dirname "$0")"

echo "Installing dependencies..."
cd backend && npm install --omit=dev && cd ..
cd frontend && npm install && cd ..

echo "Building frontend..."
cd frontend && npm run build && cd ..

echo "Building backend..."
cd backend && npm run build && cd ..

echo "Seeding database (skips if already done)..."
cd backend && npm run seed 2>/dev/null || true && cd ..

echo ""
echo "Starting RMS on http://YOUR_SERVER_IP:5001"
cd backend && node dist/index.js
