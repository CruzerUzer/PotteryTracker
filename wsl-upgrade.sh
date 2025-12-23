#!/bin/bash
# PotteryTracker WSL Upgrade Script
# This script upgrades an existing PotteryTracker installation on WSL
# Run from the project root directory: bash wsl-upgrade.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${1:-$HOME/PotteryTracker}"
BACKUP_DIR="$HOME/PotteryTracker-backup-$(date +%Y%m%d-%H%M%S)"
USE_PM2=true  # Set to false if not using PM2

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PotteryTracker WSL Upgrade Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project directory not found: $PROJECT_DIR${NC}"
    echo "Usage: bash wsl-upgrade.sh [PROJECT_DIR]"
    echo "Default: ~/PotteryTracker"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${GREEN}Working directory: $(pwd)${NC}"
echo ""

# Step 1: Backup current installation
echo -e "${YELLOW}Step 1: Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
cp -r backend/database "$BACKUP_DIR/" 2>/dev/null || true
cp -r backend/uploads "$BACKUP_DIR/" 2>/dev/null || true
cp backend/.env "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}Backup created at: $BACKUP_DIR${NC}"
echo ""

# Step 2: Stop services (if using PM2)
if [ "$USE_PM2" = true ] && command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Step 2: Stopping PM2 services...${NC}"
    if pm2 list | grep -q "pottery"; then
        pm2 stop all || true
        echo -e "${GREEN}Services stopped${NC}"
    else
        echo -e "${YELLOW}No PM2 services found to stop${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}Step 2: Skipping PM2 stop (PM2 not available or disabled)${NC}"
    echo -e "${YELLOW}If server is running manually, stop it with Ctrl+C in its terminal${NC}"
    echo ""
fi

# Step 3: Pull latest code from Git
echo -e "${YELLOW}Step 3: Pulling latest code from Git...${NC}"
if [ -d ".git" ]; then
    git fetch origin
    # Check for local changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}Local changes detected. Stashing changes...${NC}"
        git stash save "WSL upgrade stash $(date +%Y%m%d-%H%M%S)" || {
            echo -e "${RED}Warning: Could not stash changes. You may need to commit or discard them manually.${NC}"
            echo -e "${YELLOW}Continuing with existing code...${NC}"
        }
    fi
    git pull origin main || git pull origin master || {
        echo -e "${RED}Warning: Git pull failed. Continuing with existing code...${NC}"
        echo -e "${YELLOW}You may need to resolve conflicts manually and run: git pull origin main${NC}"
    }
    echo -e "${GREEN}Code updated${NC}"
else
    echo -e "${YELLOW}Not a git repository. Skipping git pull.${NC}"
    echo -e "${YELLOW}If you need to update code, copy files manually or clone from git.${NC}"
fi
echo ""

# Step 4: Update backend dependencies
echo -e "${YELLOW}Step 4: Updating backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install
echo -e "${GREEN}Backend dependencies updated${NC}"
echo ""

# Step 5: Rebuild native modules (critical for sqlite3 on WSL)
echo -e "${YELLOW}Step 5: Rebuilding native modules (sqlite3)...${NC}"
npm rebuild sqlite3 || {
    echo -e "${RED}Warning: sqlite3 rebuild failed. Trying clean install...${NC}"
    rm -rf node_modules/sqlite3
    npm install sqlite3 --build-from-source || {
        echo -e "${RED}Error: Failed to rebuild sqlite3. You may need to:${NC}"
        echo -e "${RED}  cd backend && npm rebuild sqlite3 --build-from-source${NC}"
    }
}
echo -e "${GREEN}Native modules rebuilt${NC}"
echo ""

# Step 6: Update frontend dependencies and rebuild
echo -e "${YELLOW}Step 6: Updating frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install
echo -e "${GREEN}Frontend dependencies updated${NC}"
echo ""

echo -e "${YELLOW}Step 7: Building frontend for production...${NC}"
# Ensure node_modules/.bin is in PATH and vite is executable
export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true
npm run build || {
    echo -e "${RED}Build failed. Trying with npx...${NC}"
    npx vite build || {
        echo -e "${RED}Error: Frontend build failed.${NC}"
        echo -e "${YELLOW}Try manually: cd frontend && npm run build${NC}"
        exit 1
    }
}

# Verify build output exists
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}Error: Frontend build output not found in dist/ directory${NC}"
    exit 1
fi

# Verify version.js was generated correctly
if [ -f "src/version.js" ]; then
    VERSION_IN_FILE=$(grep -oP "FRONTEND_VERSION = '\K[^']+" src/version.js || echo "")
    PACKAGE_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    if [ "$VERSION_IN_FILE" != "$PACKAGE_VERSION" ]; then
        echo -e "${YELLOW}Warning: version.js doesn't match package.json. Regenerating...${NC}"
        node generate-version.js 2>/dev/null || {
            echo -e "${YELLOW}generate-version.js not found, using fallback...${NC}"
            node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));const v=pkg.version;fs.writeFileSync('src/version.js','// Auto-generated from package.json\\nexport const FRONTEND_VERSION = \\''+v+'\\';\\n','utf8');"
        }
        echo -e "${GREEN}version.js regenerated${NC}"
    fi
else
    echo -e "${YELLOW}Warning: version.js not found. Generating...${NC}"
    node generate-version.js 2>/dev/null || {
        echo -e "${YELLOW}generate-version.js not found, using fallback...${NC}"
        node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));const v=pkg.version;fs.writeFileSync('src/version.js','// Auto-generated from package.json\\nexport const FRONTEND_VERSION = \\''+v+'\\';\\n','utf8');"
    }
    echo -e "${GREEN}version.js generated${NC}"
fi

echo -e "${GREEN}Frontend built successfully${NC}"
echo -e "${GREEN}Build output: $(ls -lh dist/ | head -5)${NC}"
echo ""

# Step 7.5: Restart Nginx to serve new frontend build
echo -e "${YELLOW}Step 7.5: Restarting Nginx to serve new frontend build...${NC}"
if command -v nginx &> /dev/null; then
    if sudo nginx -t 2>/dev/null; then
        # Use restart instead of reload to ensure new files are served
        sudo service nginx restart 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || {
            echo -e "${YELLOW}Warning: Could not restart Nginx. Trying reload...${NC}"
            sudo service nginx reload 2>/dev/null || sudo systemctl reload nginx 2>/dev/null || {
                echo -e "${RED}Error: Could not restart or reload Nginx.${NC}"
                echo -e "${YELLOW}Please restart manually: sudo service nginx restart${NC}"
            }
        }
        echo -e "${GREEN}Nginx restarted${NC}"
        
        # Wait a moment for Nginx to fully restart
        sleep 2
        
        # Verify Nginx is serving the new build
        if [ -f "dist/index.html" ]; then
            echo -e "${GREEN}Verifying Nginx can access build files...${NC}"
            NGINX_ROOT=$(sudo nginx -T 2>/dev/null | grep -oP "root\s+\K[^;]+" | head -1 | tr -d ';' || echo "")
            if [ -n "$NGINX_ROOT" ] && [ -d "$NGINX_ROOT" ]; then
                if [ -f "$NGINX_ROOT/index.html" ]; then
                    echo -e "${GREEN}Nginx root directory verified: $NGINX_ROOT${NC}"
                else
                    echo -e "${YELLOW}Warning: Nginx root ($NGINX_ROOT) doesn't contain index.html${NC}"
                    echo -e "${YELLOW}Expected: $NGINX_ROOT/index.html${NC}"
                    echo -e "${YELLOW}Actual build location: $(pwd)/dist/index.html${NC}"
                fi
            fi
        fi
    else
        echo -e "${YELLOW}Warning: Nginx configuration test failed. Skipping restart.${NC}"
        echo -e "${YELLOW}Check configuration: sudo nginx -t${NC}"
    fi
else
    echo -e "${YELLOW}Nginx not found. Skipping Nginx restart.${NC}"
    echo -e "${YELLOW}If using Nginx, restart manually: sudo service nginx restart${NC}"
fi
echo ""

# Step 7: Ensure directories exist
echo -e "${YELLOW}Step 8: Ensuring required directories exist...${NC}"
cd "$PROJECT_DIR/backend"
mkdir -p uploads
mkdir -p .cursor
chmod 755 uploads 2>/dev/null || true
echo -e "${GREEN}Directories ready${NC}"
echo ""

# Step 9: Restore backup if needed (database and uploads)
echo -e "${YELLOW}Step 10: Restoring data from backup...${NC}"
if [ -d "$BACKUP_DIR/database" ]; then
    # Database files are already in place, just ensure they exist
    echo -e "${GREEN}Database files preserved${NC}"
fi
if [ -d "$BACKUP_DIR/uploads" ]; then
    # Only copy missing files, don't overwrite
    cp -rn "$BACKUP_DIR/uploads/"* uploads/ 2>/dev/null || true
    echo -e "${GREEN}Upload files preserved${NC}"
fi
if [ -f "$BACKUP_DIR/.env" ]; then
    if [ ! -f ".env" ]; then
        cp "$BACKUP_DIR/.env" .env
        echo -e "${GREEN}.env file restored${NC}"
    else
        echo -e "${YELLOW}.env file exists, not overwriting${NC}"
    fi
fi
echo ""

# Step 10: Restart backend services (if using PM2)
if [ "$USE_PM2" = true ] && command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Step 11: Restarting PM2 services...${NC}"
    cd "$PROJECT_DIR/backend"
    if pm2 list | grep -q "pottery"; then
        pm2 restart all || {
            echo -e "${YELLOW}PM2 restart failed. Trying to start...${NC}"
            pm2 start server.js --name pottery-api
        }
    else
        echo -e "${YELLOW}No existing PM2 services. Starting new...${NC}"
        pm2 start server.js --name pottery-api
    fi
    pm2 save
    echo -e "${GREEN}Services restarted${NC}"
    echo ""
    echo -e "${BLUE}PM2 Status:${NC}"
    pm2 status
    echo ""
else
    echo -e "${YELLOW}Step 11: Skipping PM2 restart${NC}"
    echo -e "${YELLOW}To start manually, run:${NC}"
    echo -e "${YELLOW}  cd $PROJECT_DIR/backend && npm start${NC}"
    echo -e "${YELLOW}Or with PM2:${NC}"
    echo -e "${YELLOW}  cd $PROJECT_DIR/backend && pm2 start server.js --name pottery-api${NC}"
    echo ""
fi

# Step 11: Verify installation
echo -e "${YELLOW}Step 12: Verifying installation...${NC}"
cd "$PROJECT_DIR/backend"

# Check Node.js version
NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js: $NODE_VERSION${NC}"

# Check if database exists
if [ -f "database/database.db" ] || [ -f "$(node -e "console.log(require('path').resolve(process.env.DB_PATH || 'database/database.db'))")" ]; then
    echo -e "${GREEN}Database: Found${NC}"
else
    echo -e "${YELLOW}Database: Not found (run 'npm run init-db' if needed)${NC}"
fi

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${GREEN}Environment: .env file found${NC}"
else
    echo -e "${YELLOW}Environment: .env file not found (copy from .env.example)${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Upgrade completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Backup location: $BACKUP_DIR${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check server logs: pm2 logs (if using PM2)"
echo "2. Test the application: http://localhost or your configured domain"
echo "3. If issues occur, restore from backup: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}If you encounter issues:${NC}"
echo "- Check .cursor/debug.log for debug information"
echo "- Verify .env configuration"
echo "- Ensure database is initialized: cd backend && npm run init-db"
echo "- Rebuild sqlite3 if needed: cd backend && npm rebuild sqlite3"
echo ""

