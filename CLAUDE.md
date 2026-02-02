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

- **Always create a new branch** for new features and bug fixes: `git checkout -b feature/<feature-name>`
- Branch naming: `feature/<name>`, `fix/<name>`, `refactor/<name>`
- Push branch and let user test before merging to main
- Never commit directly to main

## GitHub Issues Workflow

When working on GitHub Issues, follow this process:

### 1. Read Issue
```bash
gh issue view <number> --json title,body,comments
gh issue list  # To see all open issues
```

### 2. Plan & Implement
- Create a feature branch: `git checkout -b feature/issue-<number>-<short-description>`
- Implement the changes according to the issue requirements
- Follow verification steps (tests + build)

### 3. Report Progress on Issue
```bash
# Add comment with implementation details
gh issue comment <number> --body "Implementation complete: <summary of changes>"

# Close issue when merged to main
gh issue close <number>
```

### 4. Sub-Issues
- Check if the issue has related sub-issues that should be addressed together
- Reference parent issue in commits: `Fixes #<number>` or `Part of #<parent-number>`

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

## File Boundaries

- **Safe to edit**: `/frontend/src/`, `/backend/routes/`, `/backend/middleware/`
- **Careful**: `/backend/database/schema.sql` (requires migrations)
- **Never touch**: `/node_modules/`, `/.git/`, `/backend/database/database.db`
