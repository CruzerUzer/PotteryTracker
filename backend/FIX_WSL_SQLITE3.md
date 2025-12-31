# Fix sqlite3 Native Module Issue on WSL

## Problem
The `sqlite3` package contains native bindings that are platform-specific. If you copied `node_modules` from Windows, the native modules are compiled for Windows and won't work on Linux/WSL.

## Solution

You have two options:

### Option 1: Rebuild native modules (Recommended)
```bash
cd /srv/PotteryTracker/backend
npm rebuild sqlite3
```

### Option 2: Clean reinstall (If rebuild doesn't work)
```bash
cd /srv/PotteryTracker/backend
rm -rf node_modules package-lock.json
npm install
```

## After fixing, initialize the database:
```bash
cd /srv/PotteryTracker/backend
npm run init-db
```

This should now work correctly on WSL/Linux.




