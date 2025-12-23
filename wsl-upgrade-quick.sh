#!/bin/bash
# Quick WSL Upgrade - Minimal version
# Usage: bash wsl-upgrade-quick.sh [PROJECT_DIR]

PROJECT_DIR="${1:-$HOME/PotteryTracker}"

echo "Upgrading PotteryTracker at $PROJECT_DIR..."

cd "$PROJECT_DIR" || exit 1

# Stop PM2 if available
command -v pm2 &> /dev/null && pm2 stop all 2>/dev/null || true

# Pull code (if git repo)
if [ -d ".git" ]; then
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        git stash save "WSL upgrade stash $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
    fi
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "Not a git repo or pull failed"
fi

# Update backend
cd backend
npm install
npm rebuild sqlite3 || npm install sqlite3 --build-from-source

# Update frontend
cd ../frontend
npm install
export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true

# Ensure version.js is generated before build
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('src/version.js',\`// Auto-generated from package.json\\nexport const FRONTEND_VERSION = '\${pkg.version}';\\n\`, 'utf8');" 2>/dev/null || true

npm run build || npx vite build

# Restart Nginx to serve new build (use restart, not reload, to clear cache)
command -v nginx &> /dev/null && sudo nginx -t 2>/dev/null && (sudo service nginx restart 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || true) || true

# Restart PM2 if available
cd ../backend
if command -v pm2 &> /dev/null; then
    pm2 restart all 2>/dev/null || pm2 start server.js --name pottery-api
    pm2 save
else
    echo "PM2 not found. Start manually with: cd backend && npm start"
fi

echo "Upgrade complete!"

