# WSL Upgrade Package

This package contains scripts to upgrade your PotteryTracker installation on WSL.

## Quick Start

### Option 1: Run directly from Windows path (Easiest)

```bash
# Open WSL terminal
wsl

# Run the full upgrade script (with backups)
bash /mnt/c/Users/AdamFaris/Documents/Programmering/PotteryTracker/wsl-upgrade.sh ~/PotteryTracker

# OR run the quick version (no backups, faster)
bash /mnt/c/Users/AdamFaris/Documents/Programmering/PotteryTracker/wsl-upgrade-quick.sh ~/PotteryTracker
```

### Option 2: Copy script to WSL and run

1. **Copy the script to WSL:**
   ```bash
   cp /mnt/c/Users/AdamFaris/Documents/Programmering/PotteryTracker/wsl-upgrade.sh ~/PotteryTracker/
   cd ~/PotteryTracker
   chmod +x wsl-upgrade.sh
   ```

2. **Run the upgrade:**
   ```bash
   ./wsl-upgrade.sh
   ```

### Option 3: Use Git (if repository is cloned on WSL)

If you've cloned the repository on WSL, the scripts are already there:
```bash
cd ~/PotteryTracker
chmod +x wsl-upgrade.sh wsl-upgrade-quick.sh
./wsl-upgrade.sh
```

## Scripts Available

- **`wsl-upgrade.sh`** - Full upgrade with backups, detailed output, and verification
- **`wsl-upgrade-quick.sh`** - Minimal version, faster, no backups (use when you're confident)

## What the Script Does

1. **Creates a backup** of your database, uploads, and .env file
2. **Stops PM2 services** (if using PM2)
3. **Pulls latest code** from Git (if repository is cloned)
4. **Updates backend dependencies** (`npm install`)
5. **Rebuilds native modules** (sqlite3) - **Critical for WSL**
6. **Updates frontend dependencies** and rebuilds production bundle
7. **Ensures directories exist** (uploads, .cursor)
8. **Restores data** from backup (preserves your data)
9. **Restarts PM2 services** (if using PM2)
10. **Verifies installation** and shows status

## Manual Upgrade Steps (if script fails)

If the automated script fails, follow these steps manually:

```bash
# 1. Navigate to project
cd ~/PotteryTracker  # or /srv/PotteryTracker

# 2. Stop services
pm2 stop all  # if using PM2
# OR kill the process manually

# 3. Pull latest code (if using git)
git pull origin main

# 4. Update backend
cd backend
npm install
npm rebuild sqlite3  # CRITICAL for WSL

# 5. Update frontend
cd ../frontend
npm install
npm run build

# 6. Restart services
cd ../backend
pm2 restart all  # or pm2 start server.js --name pottery-api
pm2 save
```

## Troubleshooting

### sqlite3 rebuild fails

```bash
cd backend
rm -rf node_modules/sqlite3
npm install sqlite3 --build-from-source
```

### PM2 not found

Install PM2:
```bash
sudo npm install -g pm2
```

Or set `USE_PM2=false` in the script, or edit the script and change:
```bash
USE_PM2=false
```

### Database not found after upgrade

The script preserves your database, but if it's missing:
```bash
cd backend
npm run init-db
```

### Frontend build fails

Check Node.js version (should be 18+):
```bash
node --version
```

Update if needed:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Backup Location

Backups are stored in:
```
~/PotteryTracker-backup-YYYYMMDD-HHMMSS/
```

Contains:
- `database/` - Your SQLite database files
- `uploads/` - Uploaded images
- `.env` - Environment configuration

## After Upgrade

1. **Check logs:**
   ```bash
   pm2 logs  # if using PM2
   # OR
   tail -f backend/.cursor/debug.log
   ```

2. **Test the application:**
   - Local: http://localhost
   - Remote: http://90.143.21.228

3. **Verify services:**
   ```bash
   pm2 status
   sudo service nginx status
   ```

## Notes

- The script preserves all your data (database, uploads, .env)
- Native modules (sqlite3) are rebuilt to ensure WSL compatibility
- If you're not using PM2, the script will skip PM2-related steps
- The script creates a timestamped backup before making changes

