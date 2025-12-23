#!/bin/bash
# Quick fix script for version display issue on WSL
# Usage: bash wsl-fix-version.sh [PROJECT_DIR]

PROJECT_DIR="${1:-$HOME/PotteryTracker}"

echo "========================================="
echo "PotteryTracker Version Fix Script"
echo "========================================="
echo ""

cd "$PROJECT_DIR" || exit 1

# Step 1: Check current versions
echo "Step 1: Checking current versions..."
FRONTEND_PKG_VERSION=$(node -p "require('./frontend/package.json').version" 2>/dev/null || echo "unknown")
BACKEND_PKG_VERSION=$(node -p "require('./backend/package.json').version" 2>/dev/null || echo "unknown")
echo "  Frontend package.json: $FRONTEND_PKG_VERSION"
echo "  Backend package.json: $BACKEND_PKG_VERSION"

# Step 2: Fix frontend version.js
echo ""
echo "Step 2: Ensuring frontend/src/version.js is correct..."
cd frontend
if [ -f "src/version.js" ]; then
    CURRENT_VERSION=$(grep -oP "FRONTEND_VERSION = '\K[^']+" src/version.js 2>/dev/null || echo "")
    echo "  Current version.js: $CURRENT_VERSION"
    if [ "$CURRENT_VERSION" != "$FRONTEND_PKG_VERSION" ]; then
        echo "  Mismatch detected! Regenerating version.js..."
        node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('src/version.js',\`// Auto-generated from package.json\\nexport const FRONTEND_VERSION = '\${pkg.version}';\\n\`, 'utf8');"
        echo "  ✓ version.js regenerated"
    else
        echo "  ✓ version.js is correct"
    fi
else
    echo "  version.js not found! Generating..."
    node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('src/version.js',\`// Auto-generated from package.json\\nexport const FRONTEND_VERSION = '\${pkg.version}';\\n\`, 'utf8');"
    echo "  ✓ version.js generated"
fi

# Step 3: Rebuild frontend
echo ""
echo "Step 3: Rebuilding frontend..."
export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true
npm run build || {
    echo "  Build failed with npm run build, trying npx vite build..."
    npx vite build || {
        echo "  ✗ Build failed!"
        exit 1
    }
}

# Verify build
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "  ✗ Build output not found!"
    exit 1
fi
echo "  ✓ Frontend built successfully"

# Step 4: Check Nginx configuration
echo ""
echo "Step 4: Checking Nginx configuration..."
if command -v nginx &> /dev/null; then
    NGINX_ROOT=$(sudo nginx -T 2>/dev/null | grep -A 5 "location /" | grep -oP "root\s+\K[^;]+" | head -1 | tr -d ';' | xargs || echo "")
    if [ -n "$NGINX_ROOT" ]; then
        echo "  Nginx root: $NGINX_ROOT"
        ACTUAL_BUILD=$(pwd)/dist
        echo "  Actual build: $ACTUAL_BUILD"
        
        if [ "$NGINX_ROOT" != "$ACTUAL_BUILD" ]; then
            echo "  ⚠ Warning: Nginx root doesn't match build location!"
            echo "  You may need to update Nginx config or create a symlink"
        else
            echo "  ✓ Nginx root matches build location"
        fi
        
        if [ -f "$NGINX_ROOT/index.html" ]; then
            echo "  ✓ Nginx can access index.html"
        else
            echo "  ✗ Nginx cannot access index.html at $NGINX_ROOT/index.html"
        fi
    else
        echo "  ⚠ Could not determine Nginx root from config"
    fi
    
    # Test Nginx config
    if sudo nginx -t 2>/dev/null; then
        echo "  ✓ Nginx configuration is valid"
    else
        echo "  ✗ Nginx configuration has errors!"
        sudo nginx -t
    fi
else
    echo "  ⚠ Nginx not found"
fi

# Step 5: Restart Nginx
echo ""
echo "Step 5: Restarting Nginx..."
if command -v nginx &> /dev/null; then
    if sudo nginx -t 2>/dev/null; then
        sudo service nginx restart 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || {
            echo "  ⚠ Could not restart Nginx, trying reload..."
            sudo service nginx reload 2>/dev/null || sudo systemctl reload nginx 2>/dev/null || {
                echo "  ✗ Could not restart or reload Nginx"
                echo "  Please restart manually: sudo service nginx restart"
            }
        }
        sleep 2
        echo "  ✓ Nginx restarted"
    else
        echo "  ✗ Nginx config test failed, skipping restart"
    fi
else
    echo "  ⚠ Nginx not found, skipping restart"
fi

# Step 6: Check backend version endpoint
echo ""
echo "Step 6: Checking backend version endpoint..."
cd ../backend
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list 2>/dev/null | grep -i pottery || echo "")
    if [ -n "$PM2_STATUS" ]; then
        echo "  PM2 is running pottery-api"
        sleep 1
        BACKEND_VERSION_RESPONSE=$(curl -s http://localhost:3001/api/version 2>/dev/null || echo "")
        if [ -n "$BACKEND_VERSION_RESPONSE" ]; then
            echo "  Backend version endpoint response: $BACKEND_VERSION_RESPONSE"
            BACKEND_VERSION=$(echo "$BACKEND_VERSION_RESPONSE" | grep -oP '"version":\s*"\K[^"]+' || echo "unknown")
            echo "  ✓ Backend version endpoint working: $BACKEND_VERSION"
        else
            echo "  ✗ Backend version endpoint not responding"
            echo "  Try: pm2 restart pottery-api"
        fi
    else
        echo "  ⚠ PM2 not running pottery-api"
        echo "  Start with: pm2 start server.js --name pottery-api"
    fi
else
    echo "  ⚠ PM2 not found"
fi

echo ""
echo "========================================="
echo "Fix script complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Clear your browser cache (Ctrl+Shift+R or Ctrl+F5)"
echo "2. Visit http://90.143.21.228/"
echo "3. Check browser console (F12) for any errors"
echo "4. Verify version display in footer"
echo ""

