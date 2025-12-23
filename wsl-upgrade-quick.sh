#!/bin/bash
# Quick WSL Upgrade - Minimal version
# Usage: bash wsl-upgrade-quick.sh [PROJECT_DIR]

PROJECT_DIR="${1:-$HOME/PotteryTracker}"

echo "Upgrading PotteryTracker at $PROJECT_DIR..."

cd "$PROJECT_DIR" || exit 1

# Stop PM2 if available
command -v pm2 &> /dev/null && pm2 stop all 2>/dev/null || true

# Pull code (if git repo)
[ -d ".git" ] && git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "Not a git repo or pull failed"

# Update backend
cd backend
npm install
npm rebuild sqlite3 || npm install sqlite3 --build-from-source

# Update frontend
cd ../frontend
npm install
npm run build

# Restart PM2 if available
cd ../backend
if command -v pm2 &> /dev/null; then
    pm2 restart all 2>/dev/null || pm2 start server.js --name pottery-api
    pm2 save
else
    echo "PM2 not found. Start manually with: cd backend && npm start"
fi

echo "Upgrade complete!"

