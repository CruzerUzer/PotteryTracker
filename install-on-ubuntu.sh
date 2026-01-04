#!/bin/bash
# PotteryTracker Ubuntu Installation Script
# This script installs PotteryTracker on Ubuntu (including WSL)
# Run from any directory: bash install-on-ubuntu.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PotteryTracker Ubuntu Installation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# STEP 1: COLLECT ALL USER INPUT AT THE START
# ============================================================================

echo -e "${YELLOW}Please provide the following information:${NC}"
echo ""

# Installation directory
read -p "Installation directory (default: /srv/PotteryTracker): " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/srv/PotteryTracker}"
echo ""

# Project source
echo "How do you want to get the project?"
echo "  1) Clone from GitHub (recommended)"
echo "  2) Copy from Windows path (/mnt/c/...)"
echo "  3) Use existing directory"
read -p "Enter choice (1-3): " SOURCE_CHOICE
echo ""

if [ "$SOURCE_CHOICE" = "1" ]; then
    read -p "GitHub repository URL (default: https://github.com/CruzerUzer/PotteryTracker.git): " GIT_URL
    GIT_URL="${GIT_URL:-https://github.com/CruzerUzer/PotteryTracker.git}"
    read -p "Branch name (default: main): " GIT_BRANCH
    GIT_BRANCH="${GIT_BRANCH:-main}"
elif [ "$SOURCE_CHOICE" = "2" ]; then
    read -p "Windows path (e.g., /mnt/c/Users/YourName/Documents/PotteryTracker): " WINDOWS_PATH
elif [ "$SOURCE_CHOICE" = "3" ]; then
    read -p "Existing directory path: " EXISTING_DIR
    INSTALL_DIR="$EXISTING_DIR"
fi
echo ""

# Nginx configuration
echo "Nginx Configuration:"
read -p "Server name/domain (default: _ for any): " SERVER_NAME
SERVER_NAME="${SERVER_NAME:-_}"
read -p "Install Nginx from official repository (latest) instead of Ubuntu repo? (y/n, default: n): " USE_NGINX_OFFICIAL
USE_NGINX_OFFICIAL="${USE_NGINX_OFFICIAL:-n}"
echo ""

# PM2 configuration
read -p "PM2 process name (default: pottery-api): " PM2_NAME
PM2_NAME="${PM2_NAME:-pottery-api}"
read -p "Set up PM2 to start on boot? (y/n, default: y): " PM2_STARTUP
PM2_STARTUP="${PM2_STARTUP:-y}"
echo ""

# Node.js version
read -p "Node.js major version (default: 20): " NODE_VERSION
NODE_VERSION="${NODE_VERSION:-20}"
echo ""

# Backend configuration
read -p "Backend port (default: 3001): " BACKEND_PORT
BACKEND_PORT="${BACKEND_PORT:-3001}"
read -p "Create .env file from .env.example? (y/n, default: y): " CREATE_ENV
CREATE_ENV="${CREATE_ENV:-y}"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Installation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Installation directory: $INSTALL_DIR"
echo "Source: $SOURCE_CHOICE"
if [ "$SOURCE_CHOICE" = "1" ]; then
    echo "  Repository: $GIT_URL"
    echo "  Branch: $GIT_BRANCH"
elif [ "$SOURCE_CHOICE" = "2" ]; then
    echo "  Windows path: $WINDOWS_PATH"
fi
echo "Server name: $SERVER_NAME"
echo "Nginx: $([ "$USE_NGINX_OFFICIAL" = "y" ] && echo "Official repository" || echo "Ubuntu repository")"
echo "PM2 name: $PM2_NAME"
echo "PM2 startup: $PM2_STARTUP"
echo "Node.js version: $NODE_VERSION"
echo "Backend port: $BACKEND_PORT"
echo ""
read -p "Continue with installation? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Installation cancelled."
    exit 0
fi
echo ""

# ============================================================================
# STEP 2: SYSTEM UPDATE AND DEPENDENCIES
# ============================================================================

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y
echo -e "${GREEN}System updated${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing required packages...${NC}"
sudo apt install -y curl wget git build-essential sqlite3
echo -e "${GREEN}Required packages installed${NC}"
echo ""

# ============================================================================
# STEP 3: INSTALL NODE.JS
# ============================================================================

echo -e "${YELLOW}Step 3: Installing Node.js ${NODE_VERSION}...${NC}"
if command -v node &> /dev/null; then
    CURRENT_NODE=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE" = "$NODE_VERSION" ]; then
        echo -e "${GREEN}Node.js ${NODE_VERSION} already installed${NC}"
    else
        echo -e "${YELLOW}Node.js ${CURRENT_NODE} detected, upgrading to ${NODE_VERSION}...${NC}"
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
    sudo apt install -y nodejs
fi

NODE_VER=$(node --version)
NPM_VER=$(npm --version)
echo -e "${GREEN}Node.js installed: $NODE_VER${NC}"
echo -e "${GREEN}npm installed: $NPM_VER${NC}"
echo ""

# ============================================================================
# STEP 4: INSTALL PM2
# ============================================================================

echo -e "${YELLOW}Step 4: Installing PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}PM2 already installed${NC}"
else
    sudo npm install -g pm2
    echo -e "${GREEN}PM2 installed${NC}"
fi
echo ""

# ============================================================================
# STEP 5: INSTALL NGINX
# ============================================================================

echo -e "${YELLOW}Step 5: Installing Nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}Nginx already installed: $(nginx -v 2>&1)${NC}"
else
    if [ "$USE_NGINX_OFFICIAL" = "y" ]; then
        echo -e "${YELLOW}Installing from official Nginx repository...${NC}"
        curl -fsSL https://nginx.org/keys/nginx_signing.key | sudo gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
        sudo apt update
        sudo apt install -y nginx
    else
        sudo apt install -y nginx
    fi
    echo -e "${GREEN}Nginx installed: $(nginx -v 2>&1)${NC}"
fi
echo ""

# ============================================================================
# STEP 6: GET PROJECT FILES
# ============================================================================

echo -e "${YELLOW}Step 6: Getting project files...${NC}"

if [ "$SOURCE_CHOICE" = "1" ]; then
    # Clone from GitHub
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Directory exists, pulling latest changes...${NC}"
        cd "$INSTALL_DIR"
        git fetch origin
        git checkout "$GIT_BRANCH" 2>/dev/null || git checkout -b "$GIT_BRANCH" "origin/$GIT_BRANCH"
        git pull origin "$GIT_BRANCH"
    else
        echo -e "${GREEN}Cloning repository...${NC}"
        # Create parent directory with sudo if needed (e.g., /srv)
        PARENT_DIR=$(dirname "$INSTALL_DIR")
        if [ ! -w "$PARENT_DIR" ]; then
            echo -e "${YELLOW}Creating parent directory with sudo...${NC}"
            sudo mkdir -p "$PARENT_DIR"
            sudo chown -R $USER:$USER "$PARENT_DIR"
        fi
        git clone -b "$GIT_BRANCH" "$GIT_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
elif [ "$SOURCE_CHOICE" = "2" ]; then
    # Copy from Windows
    if [ ! -d "$WINDOWS_PATH" ]; then
        echo -e "${RED}Error: Windows path not found: $WINDOWS_PATH${NC}"
        exit 1
    fi
    echo -e "${GREEN}Copying from Windows path...${NC}"
    PARENT_DIR=$(dirname "$INSTALL_DIR")
    if [ ! -w "$PARENT_DIR" ]; then
        echo -e "${YELLOW}Creating parent directory with sudo...${NC}"
        sudo mkdir -p "$PARENT_DIR"
        sudo chown -R $USER:$USER "$PARENT_DIR"
    else
        mkdir -p "$PARENT_DIR"
    fi
    cp -r "$WINDOWS_PATH" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
elif [ "$SOURCE_CHOICE" = "3" ]; then
    # Use existing directory
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}Error: Directory not found: $INSTALL_DIR${NC}"
        exit 1
    fi
    cd "$INSTALL_DIR"
fi

echo -e "${GREEN}Project files ready at: $(pwd)${NC}"
echo ""

# ============================================================================
# STEP 7: SET UP BACKEND
# ============================================================================

echo -e "${YELLOW}Step 7: Setting up backend...${NC}"
cd "$INSTALL_DIR/backend"

# Install dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
npm install
echo -e "${GREEN}Backend dependencies installed${NC}"

# Rebuild native modules (important for WSL/Linux)
echo -e "${YELLOW}Rebuilding native modules...${NC}"
npm rebuild sqlite3 || {
    echo -e "${YELLOW}Warning: sqlite3 rebuild failed, trying clean install...${NC}"
    rm -rf node_modules/sqlite3
    npm install sqlite3 --build-from-source || {
        echo -e "${RED}Error: Failed to rebuild sqlite3${NC}"
        exit 1
    }
}
echo -e "${GREEN}Native modules rebuilt${NC}"

# Create .env file
if [ "$CREATE_ENV" = "y" ]; then
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
        cp .env.example .env
        # Update port if different from default
        if [ "$BACKEND_PORT" != "3001" ]; then
            sed -i "s/PORT=3001/PORT=$BACKEND_PORT/" .env || true
        fi
        echo -e "${GREEN}.env file created${NC}"
        echo -e "${YELLOW}Please review and update .env file with your settings${NC}"
    elif [ -f ".env" ]; then
        echo -e "${GREEN}.env file already exists${NC}"
    fi
fi

# Initialize database
echo -e "${YELLOW}Initializing database...${NC}"
npm run init-db || {
    echo -e "${RED}Error: Database initialization failed${NC}"
    exit 1
}
echo -e "${GREEN}Database initialized${NC}"

# Create uploads directory
mkdir -p uploads
chmod 755 uploads
echo -e "${GREEN}Uploads directory created${NC}"
echo ""

# ============================================================================
# STEP 8: SET UP FRONTEND
# ============================================================================

echo -e "${YELLOW}Step 8: Setting up frontend...${NC}"
cd "$INSTALL_DIR/frontend"

# Install dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
npm install
echo -e "${GREEN}Frontend dependencies installed${NC}"

# Generate version.js
if [ -f "generate-version.js" ]; then
    echo -e "${YELLOW}Generating version.js...${NC}"
    node generate-version.js || true
fi

# Build frontend
echo -e "${YELLOW}Building frontend for production...${NC}"
export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true
npm run build || {
    echo -e "${RED}Error: Frontend build failed${NC}"
    exit 1
}

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}Error: Frontend build output not found${NC}"
    exit 1
fi

echo -e "${GREEN}Frontend built successfully${NC}"
echo ""

# ============================================================================
# STEP 9: CONFIGURE NGINX
# ============================================================================

echo -e "${YELLOW}Step 9: Configuring Nginx...${NC}"

# Use conf.d since that's what nginx.conf includes by default
NGINX_CONFIG="/etc/nginx/conf.d/potterytracker.conf"
FRONTEND_PATH="$INSTALL_DIR/frontend/dist"

# Ensure nginx conf.d directory exists
sudo mkdir -p /etc/nginx/conf.d

# Disable default nginx config if it exists
if [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo -e "${YELLOW}Disabling default nginx configuration...${NC}"
    sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled 2>/dev/null || true
fi

# Also remove default from sites-enabled if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Create Nginx configuration
sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Allow file uploads up to 10MB (matches backend MAX_FILE_SIZE)
    client_max_body_size 10M;

    # Frontend static files
    location / {
        root $FRONTEND_PATH;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # Backend API requests
    location /api {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for large file uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Image serving
    location /api/images {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        
        # Increase timeouts for large file uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

# Test configuration
if sudo nginx -t; then
    echo -e "${GREEN}Nginx configuration valid${NC}"
    sudo service nginx restart || sudo systemctl restart nginx
    echo -e "${GREEN}Nginx restarted${NC}"
else
    echo -e "${RED}Error: Nginx configuration test failed${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 10: START BACKEND WITH PM2
# ============================================================================

echo -e "${YELLOW}Step 10: Starting backend with PM2...${NC}"
cd "$INSTALL_DIR/backend"

# Stop existing process if running
pm2 stop "$PM2_NAME" 2>/dev/null || true
pm2 delete "$PM2_NAME" 2>/dev/null || true

# Start backend
pm2 start server.js --name "$PM2_NAME"
pm2 save

# Set up PM2 startup if requested
if [ "$PM2_STARTUP" = "y" ]; then
    echo -e "${YELLOW}Setting up PM2 startup on boot...${NC}"
    PM2_STARTUP_CMD=$(pm2 startup 2>/dev/null | grep -E "sudo env" || echo "")
    if [ -n "$PM2_STARTUP_CMD" ]; then
        # Fix PATH issue with spaces in Windows paths
        PM2_STARTUP_CMD_FIXED=$(echo "$PM2_STARTUP_CMD" | sed 's/env PATH=\$PATH/env "PATH=\$PATH"/')
        eval "$PM2_STARTUP_CMD_FIXED" || {
            echo -e "${YELLOW}Warning: PM2 startup configuration may have failed${NC}"
            echo -e "${YELLOW}You may need to run 'pm2 startup' manually${NC}"
        }
    fi
fi

echo -e "${GREEN}Backend started with PM2${NC}"
echo ""

# ============================================================================
# STEP 11: VERIFICATION
# ============================================================================

echo -e "${YELLOW}Step 11: Verifying installation...${NC}"

# Check PM2 status
if pm2 list | grep -q "$PM2_NAME"; then
    echo -e "${GREEN}✓ PM2 process running${NC}"
else
    echo -e "${RED}✗ PM2 process not found${NC}"
fi

# Check backend API
sleep 2
if curl -s "http://localhost:$BACKEND_PORT/api/version" > /dev/null; then
    echo -e "${GREEN}✓ Backend API responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend API not responding (may need a moment to start)${NC}"
fi

# Check Nginx
if sudo service nginx status > /dev/null 2>&1 || sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx running${NC}"
else
    echo -e "${RED}✗ Nginx not running${NC}"
fi

# Check frontend files
if [ -f "$FRONTEND_PATH/index.html" ]; then
    echo -e "${GREEN}✓ Frontend build files present${NC}"
else
    echo -e "${RED}✗ Frontend build files not found${NC}"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Installation completed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Installation details:${NC}"
echo "  Project directory: $INSTALL_DIR"
echo "  Backend port: $BACKEND_PORT"
echo "  PM2 process: $PM2_NAME"
echo "  Server name: $SERVER_NAME"
echo ""
echo -e "${YELLOW}Access your application:${NC}"
echo "  Local: http://localhost"
echo "  Network: http://$(hostname -I | awk '{print $1}')"
if [ "$SERVER_NAME" != "_" ]; then
    echo "  Domain: http://$SERVER_NAME"
fi
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Check PM2 status: pm2 status"
echo "  View PM2 logs: pm2 logs $PM2_NAME"
echo "  Restart backend: pm2 restart $PM2_NAME"
echo "  Restart Nginx: sudo service nginx restart"
echo "  View Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review backend/.env file and update if needed"
echo "2. Test the application at http://localhost"
echo "3. Set up SSL/HTTPS if needed (see DEPLOYMENT_WSL.md)"
echo "4. Configure firewall if accessing from network"
echo ""

