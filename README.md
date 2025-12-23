# PotteryTracker

A web-based system for tracking ceramic pieces, their lifecycle phases, materials, and images.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture and design documentation.

## Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: React with Vite
- **Database**: SQLite
- **File Storage**: Local file system (images stored in `backend/uploads/`)

## Project Structure

```
PotteryTracker/
├── backend/          # Express.js API server
├── frontend/         # React frontend application
├── ARCHITECTURE.md   # Detailed architecture documentation
└── README.md         # This file
```

## Prerequisites

- Node.js (v16 or higher recommended)
- npm (comes with Node.js)

**Important for WSL/Linux deployments:** If you copied `node_modules` from Windows, you must rebuild native modules:
```bash
cd backend
npm rebuild sqlite3
# Or do a clean reinstall:
rm -rf node_modules package-lock.json
npm install
```

## Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```bash
# Copy the example file
cp backend/.env.example backend/.env
```

Key environment variables:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `SESSION_SECRET` - Secret key for session encryption (REQUIRED in production)
- `DB_PATH` - Path to SQLite database file
- `UPLOADS_DIR` - Directory for uploaded images
- `MAX_FILE_SIZE` - Maximum upload size in bytes (default: 10MB)
- `IMAGE_MAX_WIDTH/HEIGHT` - Maximum image dimensions (default: 2048px)
- `THUMBNAIL_WIDTH/HEIGHT` - Thumbnail dimensions (default: 400px)
- `IMAGE_QUALITY` - JPEG quality (1-100, default: 85)
- `CORS_ORIGIN` - Allowed origins (comma-separated or 'true' for all)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Setup Instructions

### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 2: Initialize Database

The database needs to be initialized before starting the server:

```bash
cd backend
npm run init-db
```

This will:
- Create the SQLite database file at `backend/database/database.db`
- Create all necessary tables
- Insert default phases (På tork, Skröjbränd, Glaserad, Glasyrbränd)

### Step 3: Start Backend Server

```bash
cd backend
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The backend server will run on `http://localhost:3001`

### Step 4: Install Frontend Dependencies

Open a new terminal window:

```bash
cd frontend
npm install
```

### Step 5: Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

Vite automatically proxies API requests from `/api` to `http://localhost:3001/api`.

### Step 6: Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### Managing Phases

1. Click on "Phases" in the navigation
2. Click "Add New Phase" to create phases like:
   - På tork (Drying)
   - Skröjbränd (Bisque fired)
   - Glaserad (Glazed)
   - Glasyrbränd (Glaze fired)
3. Edit or delete phases as needed

### Managing Materials

1. Click on "Materials" in the navigation
2. Click "Add New Material" to create materials
3. Select the type: Clay, Glaze, or Other
4. Materials can be associated with ceramic pieces

### Creating Ceramic Pieces

1. From the main "Pieces" page, click "Add New Piece"
2. Fill in:
   - Name (required)
   - Description (optional)
   - Current Phase (optional - can be set later)
   - Materials (optional - select multiple)
3. Click "Create"

### Managing Pieces

- **View Details**: Click on any piece card to see full details
- **Edit**: Click "Edit" button on a piece card or detail page
- **Change Phase**: On the detail page, use the phase dropdown to move a piece between phases
- **Upload Images**: 
  - Go to piece detail page
  - Select an image file
  - Choose the phase when the image was taken
  - Click "Upload Image"
- **Delete**: Use the "Delete" button (this will also delete associated images)

### Filtering Pieces

On the main pieces page, use the "Filter by Phase" dropdown to show only pieces in a specific phase.

## API Endpoints

### Phases
- `GET /api/phases` - Get all phases
- `POST /api/phases` - Create a phase
- `PUT /api/phases/:id` - Update a phase
- `DELETE /api/phases/:id` - Delete a phase

### Materials
- `GET /api/materials` - Get all materials
- `POST /api/materials` - Create a material
- `PUT /api/materials/:id` - Update a material
- `DELETE /api/materials/:id` - Delete a material

### Pieces
- `GET /api/pieces` - Get all pieces (optional query: `?phase_id=X`)
- `GET /api/pieces/:id` - Get a specific piece with materials and images
- `POST /api/pieces` - Create a piece
- `PUT /api/pieces/:id` - Update a piece
- `DELETE /api/pieces/:id` - Delete a piece
- `PATCH /api/pieces/:id/phase` - Move piece to a different phase

### Images
- `POST /api/pieces/:id/images` - Upload image (multipart/form-data: file, phase_id)
- `GET /api/pieces/:id/images` - Get all images for a piece
- `GET /api/images/:id/file` - Serve image file
- `DELETE /api/images/:id` - Delete an image

## Database

The SQLite database is stored at `backend/database/database.db`.

To reset the database:
1. Stop the server
2. Delete `backend/database/database.db`
3. Run `npm run init-db` again

## File Storage

Images are stored in `backend/uploads/` directory. Each uploaded image gets a unique filename based on timestamp and random number.

**Note**: When deploying to production, consider:
- Using cloud storage (AWS S3, Cloudinary, etc.)
- Implementing proper backup strategies
- Setting up proper image optimization/resizing

## Development Notes

### Backend
- Uses ES modules (`type: "module"` in package.json)
- Database operations use `sqlite` package with async/await
- File uploads handled by `multer` middleware with automatic image optimization
- Images are automatically resized and compressed using `sharp`
- Thumbnails are generated for faster loading in list views
- Structured logging with `winston` (logs stored in `backend/logs/`)
- CORS enabled for development

### Frontend
- React with functional components and hooks
- React Router for navigation
- CSS for styling (no CSS framework to keep it simple)
- API calls abstracted in `src/services/api.js`

## Production Deployment

For production deployment:

1. **Backend**:
   - Set `NODE_ENV=production`
   - Use a process manager (PM2, systemd, etc.)
   - Configure proper CORS settings
   - Set up proper logging
   - Consider using PostgreSQL instead of SQLite
   - Use cloud storage for images

2. **Frontend**:
   - Build the production bundle: `npm run build`
   - Serve static files from `frontend/dist/`
   - Configure API endpoint URL in environment variables
   - Consider using a CDN for static assets

## Troubleshooting

### Database errors
- Make sure you've run `npm run init-db` in the backend directory
- Check that `backend/database/database.db` exists

### Port already in use
- Backend default port: 3001 (change in `backend/server.js` or set `PORT` env variable)
- Frontend default port: 3000 (change in `frontend/vite.config.js`)

### CORS errors
- Make sure backend is running
- Check that CORS is enabled in `backend/server.js`

### Image upload fails
- Check that `backend/uploads/` directory exists (created automatically)
- Verify file size is under the limit (default: 10MB, configurable via `MAX_FILE_SIZE`)
- Ensure file is a valid image format (jpg, png, gif, webp)
- Check logs in `backend/logs/` for detailed error information

### Logging
- Logs are stored in `backend/logs/`
- `combined.log` - All logs
- `error.log` - Error logs only
- Log level can be configured via `LOG_LEVEL` environment variable

## Future Enhancements

Potential features for future development:
- User authentication and multiple users
- Search and advanced filtering
- Export/import functionality
- Mobile app (using the same API)
- Image editing/cropping
- Batch operations
- Statistics and reporting
- Community features (sharing pieces)

## License

ISC
