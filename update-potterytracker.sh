#!/bin/bash
# PotteryTracker Update Script
# This script updates an existing PotteryTracker installation
# Run from any directory: bash update-potterytracker.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PotteryTracker Update Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# STEP 1: GET INSTALLATION DIRECTORY
# ============================================================================

read -p "PotteryTracker installation directory (default: /srv/PotteryTracker): " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/srv/PotteryTracker}"

if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}Error: Directory not found: $INSTALL_DIR${NC}"
    exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}Warning: Directory does not appear to be a git repository${NC}"
    echo -e "${YELLOW}This script is designed for git-based installations${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 0
    fi
fi

echo ""

# ============================================================================
# STEP 2: BACKUP CURRENT STATE
# ============================================================================

echo -e "${YELLOW}Step 1: Creating backup...${NC}"
BACKUP_DIR="${INSTALL_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}Backing up to: $BACKUP_DIR${NC}"

# Get PM2 process name if possible
cd "$INSTALL_DIR"
PM2_NAME="pottery-api"
if [ -f "package.json" ]; then
    # Try to detect PM2 name from existing process
    PM2_LIST=$(pm2 list 2>/dev/null | grep -o "pottery[^ ]*" | head -1 || true)
    if [ -n "$PM2_LIST" ]; then
        PM2_NAME="$PM2_LIST"
    fi
fi

# Ask if user wants to backup
read -p "Create backup before updating? (y/n, default: y): " CREATE_BACKUP
CREATE_BACKUP="${CREATE_BACKUP:-y}"

if [ "$CREATE_BACKUP" = "y" ]; then
    # Create backup (exclude node_modules and dist for speed, but preserve archives and uploads)
    PARENT_DIR=$(dirname "$INSTALL_DIR")
    cd "$PARENT_DIR"
    rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '.git' "$INSTALL_DIR" "$BACKUP_DIR" 2>/dev/null || {
        echo -e "${YELLOW}Warning: rsync not available, using cp (slower)...${NC}"
        cp -r "$INSTALL_DIR" "$BACKUP_DIR"
        rm -rf "$BACKUP_DIR/node_modules" "$BACKUP_DIR/dist" 2>/dev/null || true
    }
    echo -e "${GREEN}Backup created at: $BACKUP_DIR${NC}"
    echo -e "${YELLOW}Note: Archives and uploads directories are preserved in the installation${NC}"
else
    BACKUP_DIR=""
fi
echo ""

# ============================================================================
# STEP 3: UPDATE CODE
# ============================================================================

echo -e "${YELLOW}Step 2: Updating code from repository...${NC}"
cd "$INSTALL_DIR"

# Fix Git safe directory issue (common when repo is owned by different user)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Configuring Git safe directory...${NC}"
    git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
echo -e "${BLUE}Current branch: $CURRENT_BRANCH${NC}"

# Ask which branch to update to
read -p "Branch to update to (default: $CURRENT_BRANCH): " UPDATE_BRANCH
UPDATE_BRANCH="${UPDATE_BRANCH:-$CURRENT_BRANCH}"

# Stash any local changes (including untracked files that might conflict)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Stashing local changes (including untracked files)...${NC}"
    # Stash including untracked files to handle conflicts
    git stash push -u -m "Pre-update stash $(date +%Y%m%d_%H%M%S)" || {
        # If stash fails, check if there are actually changes
        if [ -n "$(git status --porcelain)" ]; then
            echo -e "${YELLOW}Warning: Could not stash changes, attempting to continue...${NC}"
        fi
    }
    
    # Fetch latest
    echo -e "${YELLOW}Fetching latest changes...${NC}"
    git fetch origin
    
    # Checkout and pull
    echo -e "${YELLOW}Updating to latest code...${NC}"
    # Try to checkout, handling case where branch doesn't exist locally
    if git checkout "$UPDATE_BRANCH" 2>/dev/null; then
        # Branch exists locally, pull updates
        git pull origin "$UPDATE_BRANCH" || {
            echo -e "${RED}Error: Failed to pull latest changes${NC}"
            echo -e "${YELLOW}You may need to resolve conflicts manually${NC}"
            exit 1
        }
    else
        # Branch doesn't exist locally, create tracking branch
        if git show-ref --verify --quiet refs/remotes/origin/"$UPDATE_BRANCH"; then
            git checkout -b "$UPDATE_BRANCH" "origin/$UPDATE_BRANCH" || {
                echo -e "${RED}Error: Failed to checkout branch $UPDATE_BRANCH${NC}"
                exit 1
            }
        else
            echo -e "${RED}Error: Branch $UPDATE_BRANCH does not exist on remote${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}Code updated successfully${NC}"
else
    echo -e "${YELLOW}Not a git repository, skipping code update${NC}"
fi
echo ""

# ============================================================================
# STEP 4: UPDATE BACKEND DEPENDENCIES
# ============================================================================

echo -e "${YELLOW}Step 3: Updating backend dependencies...${NC}"
cd "$INSTALL_DIR/backend"

if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}Backend dependencies updated${NC}"
    
    # Rebuild native modules
    echo -e "${YELLOW}Rebuilding native modules...${NC}"
    npm rebuild sqlite3 || {
        echo -e "${YELLOW}Warning: sqlite3 rebuild failed, trying clean install...${NC}"
        rm -rf node_modules/sqlite3
        npm install sqlite3 --build-from-source || {
            echo -e "${YELLOW}Warning: Failed to rebuild sqlite3, continuing anyway...${NC}"
        }
    }
else
    echo -e "${RED}Error: backend/package.json not found${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 5: UPDATE FRONTEND DEPENDENCIES
# ============================================================================

echo -e "${YELLOW}Step 4: Updating frontend dependencies...${NC}"
cd "$INSTALL_DIR/frontend"

if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}Frontend dependencies updated${NC}"
    
    # Generate version.js if script exists
    if [ -f "generate-version.js" ]; then
        echo -e "${YELLOW}Generating version.js...${NC}"
        node generate-version.js || true
    fi
else
    echo -e "${RED}Error: frontend/package.json not found${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 6: BUILD FRONTEND
# ============================================================================

echo -e "${YELLOW}Step 5: Building frontend for production...${NC}"
cd "$INSTALL_DIR/frontend"

export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true

npm run build || {
    echo -e "${RED}Error: Frontend build failed${NC}"
    echo -e "${YELLOW}You may need to fix build errors before continuing${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 1
    fi
}

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}Error: Frontend build output not found${NC}"
    exit 1
fi

echo -e "${GREEN}Frontend built successfully${NC}"
echo ""

# ============================================================================
# STEP 7: RESTART SERVICES
# ============================================================================

echo -e "${YELLOW}Step 6: Restarting services...${NC}"

# Restart backend with PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "$PM2_NAME"; then
        echo -e "${YELLOW}Restarting PM2 process: $PM2_NAME${NC}"
        pm2 restart "$PM2_NAME" || {
            echo -e "${YELLOW}Warning: PM2 restart failed, trying reload...${NC}"
            pm2 reload "$PM2_NAME" || true
        }
        pm2 save
        echo -e "${GREEN}Backend restarted${NC}"
    else
        echo -e "${YELLOW}PM2 process '$PM2_NAME' not found, starting it...${NC}"
        cd "$INSTALL_DIR/backend"
        pm2 start server.js --name "$PM2_NAME" || true
        pm2 save
    fi
else
    echo -e "${YELLOW}PM2 not found, skipping backend restart${NC}"
fi

# Restart Nginx
if command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Testing Nginx configuration...${NC}"
    if sudo nginx -t; then
        sudo service nginx reload || sudo systemctl reload nginx
        echo -e "${GREEN}Nginx reloaded${NC}"
    else
        echo -e "${YELLOW}Warning: Nginx configuration test failed${NC}"
        echo -e "${YELLOW}Nginx not reloaded, please check configuration${NC}"
    fi
else
    echo -e "${YELLOW}Nginx not found, skipping${NC}"
fi

echo ""

# ============================================================================
# STEP 8: VERIFICATION
# ============================================================================

echo -e "${YELLOW}Step 7: Verifying update...${NC}"

# Check PM2 status
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "$PM2_NAME"; then
        PM2_STATUS=$(pm2 jlist | grep -o "\"name\":\"$PM2_NAME\".*\"pm2_env\":{\"status\":\"[^\"]*\"" | grep -o "\"status\":\"[^\"]*\"" | cut -d'"' -f4)
        if [ "$PM2_STATUS" = "online" ]; then
            echo -e "${GREEN}✓ PM2 process running${NC}"
        else
            echo -e "${YELLOW}⚠ PM2 process status: $PM2_STATUS${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ PM2 process not found${NC}"
    fi
fi

# Check backend API (if we know the port)
if [ -f "$INSTALL_DIR/backend/.env" ]; then
    BACKEND_PORT=$(grep "^PORT=" "$INSTALL_DIR/backend/.env" | cut -d'=' -f2 | tr -d '"' || echo "3001")
else
    BACKEND_PORT="3001"
fi

sleep 2
if curl -s "http://localhost:$BACKEND_PORT/api/version" > /dev/null; then
    echo -e "${GREEN}✓ Backend API responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend API not responding (may need a moment to start)${NC}"
fi

# Check Nginx
if command -v nginx &> /dev/null; then
    if sudo service nginx status > /dev/null 2>&1 || sudo systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓ Nginx running${NC}"
    else
        echo -e "${YELLOW}⚠ Nginx not running${NC}"
    fi
fi

# Check frontend files
if [ -f "$INSTALL_DIR/frontend/dist/index.html" ]; then
    echo -e "${GREEN}✓ Frontend build files present${NC}"
else
    echo -e "${RED}✗ Frontend build files not found${NC}"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Update completed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Update details:${NC}"
echo "  Installation directory: $INSTALL_DIR"
echo "  Updated branch: $UPDATE_BRANCH"
if [ -n "$BACKUP_DIR" ]; then
    echo "  Backup location: $BACKUP_DIR"
fi
echo ""
echo -e "${YELLOW}Access your application:${NC}"
echo "  Local: http://localhost"
echo "  Network: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'your-server-ip')"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Check PM2 status: pm2 status"
echo "  View PM2 logs: pm2 logs $PM2_NAME"
echo "  Restart backend: pm2 restart $PM2_NAME"
echo "  Restart Nginx: sudo service nginx restart"
echo ""
if [ -n "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Backup location:${NC}"
    echo "  $BACKUP_DIR"
    echo "  (You can remove this after verifying the update works correctly)"
    echo ""
fi
echo -e "${YELLOW}If you encounter issues:${NC}"
echo "1. Check PM2 logs: pm2 logs $PM2_NAME"
echo "2. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "3. Review the backup if needed: $BACKUP_DIR"
echo "4. Restore stashed changes: cd $INSTALL_DIR && git stash list"
echo ""

