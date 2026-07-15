# PotteryTracker

> Full-stack web application for tracking ceramic pottery pieces through their lifecycle phases.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│    Database     │
│  React + Vite   │     │  Express API    │     │     SQLite      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 3000              Port 3001            database/database.db
```

## Tech Stack

### Frontend (`/frontend`)
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: Radix UI primitives
- **Routing**: React Router DOM

### Backend (`/backend`)
- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **Database**: SQLite3
- **Image Processing**: Sharp
- **Auth**: bcrypt + express-session

## Commands

### Development
```bash
# Start backend (port 3001)
cd backend && npm run dev

# Start frontend (port 3000)
cd frontend && npm run dev
```

### Testing
```bash
cd backend && npm test
```

### Database
```bash
cd backend && npm run init-db    # Initialize database
cd backend && npm run seed-db    # Seed with sample data
```

### Production Build
```bash
cd frontend && npm run build
```

## Key Directories

```
PotteryTracker/
├── frontend/src/
│   ├── components/     # React components
│   ├── contexts/       # AuthContext, ThemeContext
│   ├── services/api.js # Centralized API calls
│   └── styles/         # CSS files
├── backend/
│   ├── routes/         # Express route handlers
│   ├── middleware/     # Auth, upload middleware
│   ├── database/       # Schema, migrations, seed
│   └── utils/          # Logger, encryption, etc.
```

## Git Workflow

**CRITICAL RULE: Never work directly on `main` branch.**

- **Always create a new branch** before making any changes: `git checkout -b feature/<feature-name>`
- Branch naming: `feature/<name>`, `fix/<name>`, `refactor/<name>`, `security/<name>`
- Push branch and let user test before merging to main
- **Never commit directly to main** — even small fixes go on a branch
- Merge to main only after: tests pass + frontend builds + user approves
- Use `git checkout -b <branch>` at the very start of any session before touching code

## Important Patterns

- **API Proxy**: Frontend dev server proxies `/api` to `localhost:3001`
- **Auth Flow**: Session-based with bcrypt password hashing
- **Image Uploads**: Multer + Sharp for resizing/thumbnails
- **Multi-user**: Each user sees only their own pieces

## Verification (MANDATORY)

**CRITICAL**: Production server updates via `update-potterytracker.sh` require these steps to pass.

Before EVERY commit, verify:
1. **Backend tests**: `cd backend && npm test` - MUST pass
2. **Frontend build**: `cd frontend && npm run build` - MUST succeed
3. Manual testing of affected features

The update script runs: `npm install` (both dirs) → `npm run build` (frontend) → PM2 restart.
If tests fail or build fails, the commit will break production deployment.

## Deployment

**CRITICAL RULE: Never deploy to production without asking the user first.**
This means: do not run `deploy-frontend.sh`, `update-potterytracker.sh`, rsync to
prod, PM2/Nginx restarts, or any change to the prod server until the user has
explicitly approved that specific deploy. Merging to `main` is not approval to
deploy — ask before pushing anything to production.

Production runs at `https://potterytracker.faris.se` on `ubuntu@potterytracker.faris.se`
(dir `/srv/PotteryTracker`, PM2 process `pottery-api`, Nginx serving `frontend/dist`).
The prod VM has only **~1 GB RAM**, so `vite build` run **on the server** can be
OOM-killed (kernel prints `Killed`), which leaves `frontend/dist/` without
`index.html` and takes the site down (403/404). A 2 GB swapfile is configured to
give the build headroom.

There are **two supported deploy paths**:

### 1. Build locally + rsync (preferred for automation / Claude sessions)
Never build on the prod VM. Build on a machine with plenty of RAM and copy the
finished `dist/` over. One command from the repo root:
```bash
./deploy-frontend.sh            # builds frontend locally, rsyncs dist/ to prod, verifies 200
```
This avoids the OOM entirely. Use it for frontend-only changes. For changes that
also need `git pull` + DB migrations on prod, run those steps (or the update
script) and deploy the frontend this way.

### 2. Manual update script on the server
The operator may still run `bash /srv/PotteryTracker/update-potterytracker.sh` on
prod as `ubuntu` (never `sudo`; the script has a root guard). Answer `y` to the
backup prompt — backups go to the user-owned `/srv/potterytracker-backups`. The
2 GB swap lets the in-place `vite build` finish without OOM. If a build is ever
killed anyway, recover with path 1 (build locally + rsync).

`ubuntu` has passwordless sudo on prod. Do **not** run the update script or npm
builds as root/sudo — it creates root-owned files that break the app.

## File Boundaries

- **Safe to edit**: `/frontend/src/`, `/backend/routes/`, `/backend/middleware/`
- **Careful**: `/backend/database/schema.sql` (requires migrations)
- **Never touch**: `/node_modules/`, `/.git/`, `/backend/database/database.db`
