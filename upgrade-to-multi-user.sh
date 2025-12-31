#!/bin/bash
# PotteryTracker Upgrade Script: Main to Multi-User Branch
# This script upgrades from main branch to feature/multi-user branch
# Run from the project root directory: bash upgrade-to-multi-user.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PotteryTracker: Upgrade to Multi-User${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}Current branch: $CURRENT_BRANCH${NC}"
echo ""

# Step 1: Check for uncommitted changes
echo -e "${YELLOW}Step 1: Checking for uncommitted changes...${NC}"
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Uncommitted changes detected. Stashing...${NC}"
    git stash save "Pre-upgrade stash $(date +%Y%m%d-%H%M%S)"
    STASHED=true
else
    STASHED=false
    echo -e "${GREEN}No uncommitted changes${NC}"
fi
echo ""

# Step 2: Fetch latest from remote
echo -e "${YELLOW}Step 2: Fetching latest from remote...${NC}"
git fetch origin
echo -e "${GREEN}Fetched latest changes${NC}"
echo ""

# Step 3: Switch to main branch
echo -e "${YELLOW}Step 3: Switching to main branch...${NC}"
git checkout main
git pull origin main
echo -e "${GREEN}On main branch, up to date${NC}"
echo ""

# Step 4: Checkout or create local multi-user branch
echo -e "${YELLOW}Step 4: Setting up multi-user branch...${NC}"
if git show-ref --verify --quiet refs/heads/feature/multi-user; then
    echo -e "${GREEN}Local multi-user branch exists, checking it out...${NC}"
    git checkout feature/multi-user
    git pull origin feature/multi-user
else
    echo -e "${GREEN}Creating local multi-user branch from remote...${NC}"
    git checkout -b feature/multi-user origin/feature/multi-user
fi
echo -e "${GREEN}On feature/multi-user branch${NC}"
echo ""

# Step 5: Merge main into multi-user
echo -e "${YELLOW}Step 5: Merging main into multi-user...${NC}"
if git merge main --no-edit; then
    echo -e "${GREEN}Merge successful${NC}"
else
    echo -e "${RED}Merge conflicts detected!${NC}"
    echo -e "${YELLOW}Please resolve conflicts manually and run:${NC}"
    echo -e "${YELLOW}  git add .${NC}"
    echo -e "${YELLOW}  git commit${NC}"
    exit 1
fi
echo ""

# Step 6: Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo -e "${YELLOW}Step 6: Restoring stashed changes...${NC}"
    if git stash list | grep -q "Pre-upgrade stash"; then
        git stash pop || {
            echo -e "${YELLOW}Warning: Could not apply stash. Check with: git stash list${NC}"
        }
    fi
    echo ""
fi

# Step 7: Update dependencies
echo -e "${YELLOW}Step 7: Updating dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}Backend dependencies updated${NC}"
cd ../frontend
npm install
echo -e "${GREEN}Frontend dependencies updated${NC}"
cd ..
echo ""

# Step 8: Rebuild frontend
echo -e "${YELLOW}Step 8: Rebuilding frontend...${NC}"
cd frontend
export PATH="$PWD/node_modules/.bin:$PATH"
chmod +x node_modules/.bin/vite 2>/dev/null || true
npm run build || {
    echo -e "${RED}Frontend build failed${NC}"
    exit 1
}
echo -e "${GREEN}Frontend built successfully${NC}"
cd ..
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Upgrade to multi-user completed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Current branch: $(git branch --show-current)${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review changes: git log --oneline -10"
echo "2. Test the application"
echo "3. Push to remote: git push origin feature/multi-user"
echo "4. If stashed changes were restored, review and commit them"
echo ""

