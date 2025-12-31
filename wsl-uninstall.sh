#!/bin/bash
# Uninstall PotteryTracker from WSL
# Usage: bash wsl-uninstall.sh [PROJECT_DIR]

PROJECT_DIR="${1:-$HOME/PotteryTracker}"

echo "========================================="
echo "PotteryTracker WSL Uninstall Script"
echo "========================================="
echo ""
echo "This will remove PotteryTracker from WSL:"
echo "  - Stop and remove PM2 processes"
echo "  - Remove project directory: $PROJECT_DIR"
echo "  - Remove Nginx site configuration (optional)"
echo "  - Clean up PM2 saved processes"
echo ""

read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping PM2 processes..."
if command -v pm2 &> /dev/null; then
    # Stop all pottery-related PM2 processes
    pm2 stop pottery-api 2>/dev/null || true
    pm2 delete pottery-api 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
    echo "  ✓ PM2 processes stopped and removed"
else
    echo "  ⚠ PM2 not found, skipping"
fi

echo ""
echo "Step 2: Removing Nginx site configuration..."
if command -v nginx &> /dev/null; then
    # Check if potterytracker site exists
    if [ -L "/etc/nginx/sites-enabled/potterytracker" ] || [ -f "/etc/nginx/sites-enabled/potterytracker" ]; then
        read -p "  Remove Nginx site configuration? (yes/no): " REMOVE_NGINX
        if [ "$REMOVE_NGINX" = "yes" ]; then
            sudo rm -f /etc/nginx/sites-enabled/potterytracker
            sudo rm -f /etc/nginx/sites-available/potterytracker
            sudo nginx -t 2>/dev/null && sudo service nginx reload 2>/dev/null || true
            echo "  ✓ Nginx site configuration removed"
        else
            echo "  ⚠ Keeping Nginx configuration"
        fi
    else
        echo "  ⚠ Nginx site configuration not found"
    fi
else
    echo "  ⚠ Nginx not found, skipping"
fi

echo ""
echo "Step 3: Removing project directory..."
if [ -d "$PROJECT_DIR" ]; then
    read -p "  Remove project directory ($PROJECT_DIR)? (yes/no): " REMOVE_DIR
    if [ "$REMOVE_DIR" = "yes" ]; then
        rm -rf "$PROJECT_DIR"
        echo "  ✓ Project directory removed"
    else
        echo "  ⚠ Keeping project directory"
    fi
else
    echo "  ⚠ Project directory not found: $PROJECT_DIR"
fi

echo ""
echo "Step 4: Cleaning up PM2 startup script (if exists)..."
if command -v pm2 &> /dev/null; then
    # Check if PM2 startup script exists
    PM2_STARTUP=$(pm2 startup 2>/dev/null | grep -oP "sudo env PATH=.*pm2" || echo "")
    if [ -n "$PM2_STARTUP" ]; then
        echo "  ⚠ PM2 startup script is configured"
        echo "  To remove it, run: pm2 unstartup"
    else
        echo "  ✓ No PM2 startup script found"
    fi
fi

echo ""
echo "========================================="
echo "Uninstall complete!"
echo "========================================="
echo ""
echo "PotteryTracker has been removed from WSL."
echo ""
echo "To reinstall, follow the instructions in DEPLOYMENT_WSL.md"
echo "or run the setup script if available."
echo ""



