#!/bin/bash
# RMS Quick Start Script

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║      RENT MANAGEMENT SYSTEM - STARTUP        ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Install dependencies
if [ ! -d "backend/node_modules" ]; then
  echo -e "${YELLOW}Installing backend dependencies...${NC}"
  npm install --prefix backend
fi

if [ ! -d "frontend/node_modules" ]; then
  echo -e "${YELLOW}Installing frontend dependencies...${NC}"
  npm install --prefix frontend
fi

# Seed database if it doesn't exist
if [ ! -f "backend/rms.db" ]; then
  echo -e "${YELLOW}Setting up database with demo data...${NC}"
  npm run seed --prefix backend
fi

echo -e "${GREEN}"
echo "▶ Starting Backend API (port 5001)..."
npm run dev --prefix backend > /tmp/rms-backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

echo "▶ Starting Frontend (port 5173)..."
npm run dev --prefix frontend > /tmp/rms-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║              🏢 SYSTEM RUNNING               ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Frontend: http://localhost:5173             ║"
echo "║  Backend:  http://localhost:5001/api/health  ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  DEFAULT CREDENTIALS                         ║"
echo "║  Super Admin: superadmin@rms.rw              ║"
echo "║  Password:    Admin@1234                     ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Admin UBUMWE: admin.ubumwe@rms.rw           ║"
echo "║  Admin IHURIRO: admin.ihuriro@rms.rw         ║"
echo "║  Manager: manager.ubumwe@rms.rw              ║"
echo "║  Password: Manager@1234                      ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Press Ctrl+C to stop all services"
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped.'; exit 0" INT TERM

wait
