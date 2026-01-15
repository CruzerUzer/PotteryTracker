# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PotteryTracker is a multi-user web application for tracking ceramic pieces through their lifecycle phases (drying, bisque firing, glazing, glaze firing). Users can track materials used, upload images at each phase, and mark pieces as done.

## Tech Stack

- **Backend**: Node.js + Express.js (ES modules)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: SQLite
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **Image Processing**: Sharp (auto-resize, thumbnail generation)

## Development Commands

### Backend (from `/backend`)
```bash
npm run dev          # Start with auto-reload (node --watch)
npm start            # Production start
npm run init-db      # Initialize/reset database
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
```

### Frontend (from `/frontend`)
```bash
npm run dev          # Start Vite dev server (port 3000)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

### Running Both
Start backend first (port 3001), then frontend (port 3000). Vite proxies `/api` requests to the backend.

## Architecture

### Backend Structure
- `server.js` - Express app setup, middleware, route registration
- `routes/` - API route handlers (auth, admin, phases, materials, pieces, images, export)
- `middleware/upload.js` - Multer config for image uploads with Sharp processing
- `database/init.js` - DB initialization script
- `database/schema.sql` - Complete schema definition
- `utils/logger.js` - Winston logging configuration

### Frontend Structure
- `src/App.jsx` - Main app with routing, auth protection (ProtectedRoute, AdminRoute)
- `src/contexts/AuthContext.jsx` - Authentication state management
- `src/contexts/ThemeContext.jsx` - Dark/light theme toggle
- `src/services/api.js` - All API client functions
- `src/components/` - React components (KanbanView is the main dashboard)
- `src/components/ui/` - Reusable UI primitives (shadcn/ui style)

### Database Schema
Multi-user with cascading deletes. Key tables:
- `users` - Authentication (bcrypt passwords), admin flag
- `phases` - Per-user lifecycle phases with display order
- `materials` - Per-user materials (clay/glaze/other types)
- `ceramic_pieces` - Main entity, references user and current phase
- `piece_materials` - Many-to-many junction table
- `piece_images` - Images linked to piece and phase when taken
- `system_settings` - App-wide settings (registration toggle)
- `user_archives` - Backup archive metadata

### API Routes
All routes under `/api/`:
- `auth/` - Login, logout, register, session check
- `admin/` - User management, registration control, archives
- `phases/`, `materials/`, `pieces/` - CRUD for main entities
- `pieces/:id/images` - Image upload for pieces
- `images/:id/file` - Serve image files
- `export/` - Data export functionality

### Authentication
Session-based auth using express-session. Middleware checks `req.session.userId`. Admin routes additionally check `is_admin` flag.

## Testing

Backend tests use Jest with supertest for API testing. Test files in `backend/__tests__/routes/`. Run single test file:
```bash
npm test -- auth.test.js
```

## Environment Variables

Backend `.env` (see `.env.example`):
- `PORT` - Server port (default 3001)
- `SESSION_SECRET` - Required in production
- `DB_PATH` - SQLite database path
- `UPLOADS_DIR` - Image storage directory
- `MAX_FILE_SIZE`, `IMAGE_MAX_WIDTH/HEIGHT`, `IMAGE_QUALITY` - Image processing settings
