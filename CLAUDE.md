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

## Important Patterns

- **API Proxy**: Frontend dev server proxies `/api` to `localhost:3001`
- **Auth Flow**: Session-based with bcrypt password hashing
- **Image Uploads**: Multer + Sharp for resizing/thumbnails
- **Multi-user**: Each user sees only their own pieces

## Verification

Before committing changes:
1. `cd backend && npm test` - Run backend tests
2. `cd frontend && npm run build` - Verify frontend builds
3. Manual testing of affected features

## File Boundaries

- **Safe to edit**: `/frontend/src/`, `/backend/routes/`, `/backend/middleware/`
- **Careful**: `/backend/database/schema.sql` (requires migrations)
- **Never touch**: `/node_modules/`, `/.git/`, `/backend/database/database.db`
