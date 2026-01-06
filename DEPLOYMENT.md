# PotteryTracker - Deployment Guide

This guide covers deploying PotteryTracker to a production web server.

**For WSL deployment and internet access, see [DEPLOYMENT_WSL.md](./DEPLOYMENT_WSL.md)**

## Overview

PotteryTracker consists of:
- **Backend**: Node.js Express API server (port 3001)
- **Frontend**: React SPA built with Vite
- **Database**: SQLite (can be upgraded to PostgreSQL)
- **File Storage**: Local filesystem for images

## Pre-Deployment Checklist

### 1. Build Frontend for Production

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with optimized production files.

### 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
NODE_ENV=production
PORT=3001
# Add other environment variables as needed
```

## Deployment Options

### Option 1: Single Server Deployment (VPS/Dedicated Server)

#### Prerequisites
- Node.js (v16 or higher) installed
- Nginx or Apache web server
- Domain name (optional)

#### Steps

1. **Upload Files to Server**
   ```bash
   # Using SCP or SFTP, upload:
   # - backend/ directory
   # - frontend/dist/ directory (built files)
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install --production
   ```

3. **Initialize Database**
   ```bash
   cd backend
   npm run init-db
   ```

4. **Create Uploads Directory**
   ```bash
   mkdir -p backend/uploads
   chmod 755 backend/uploads
   ```

5. **Use PM2 for Process Management**
   ```bash
   npm install -g pm2
   cd backend
   pm2 start server.js --name pottery-api
   pm2 save
   pm2 startup  # Follow instructions to enable startup on boot
   ```

6. **Configure Nginx Reverse Proxy**

   Create `/etc/nginx/sites-available/potterytracker`:

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       # Frontend static files
       location / {
           root /path/to/frontend/dist;
           try_files $uri $uri/ /index.html;
           index index.html;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }

       # Serve images directly
       location /api/images {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }
   }
   ```

   Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/potterytracker /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. **Set Up SSL/HTTPS (Let's Encrypt)**
   
   **For detailed HTTPS setup instructions, see [HTTPS_SETUP.md](./HTTPS_SETUP.md)**
   
   Quick setup:
   ```bash
   # Install certbot
   sudo apt-get install certbot python3-certbot-nginx
   
   # Copy the Nginx HTTPS configuration template
   sudo cp nginx/potterytracker.conf /etc/nginx/sites-available/potterytracker
   
   # Edit the config file to match your paths and domain
   sudo nano /etc/nginx/sites-available/potterytracker
   
   # Enable the site
   sudo ln -sf /etc/nginx/sites-available/potterytracker /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   
   # Obtain SSL certificate (certbot will automatically configure Nginx)
   sudo certbot --nginx -d yourdomain.com
   
   # Update backend .env to enable HTTPS
   # Add: HTTPS_ENABLED=true
   # Then restart: pm2 restart pottery-api
   ```
   
   **Important**: After enabling HTTPS, update your backend `.env` file:
   ```env
   HTTPS_ENABLED=true
   NODE_ENV=production
   ```
   Then restart your backend: `pm2 restart pottery-api`

### Option 2: Cloud Platform Deployment

#### Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy Backend**
   ```bash
   cd backend
   railway init
   railway up
   ```

3. **Deploy Frontend**
   ```bash
   cd frontend
   railway init
   railway up
   ```

   Configure environment variables in Railway dashboard:
   - `NODE_ENV=production`
   - `PORT=3001`

#### Heroku

**Backend:**
```bash
cd backend
heroku create pottery-api
heroku config:set NODE_ENV=production
git subtree push --prefix backend heroku main
```

**Frontend:**
```bash
cd frontend
npm install -g serve
# Add to package.json scripts:
# "start": "serve -s dist -l 3000"
heroku create pottery-frontend
heroku config:set NODE_ENV=production
# Build and deploy
```

#### Vercel (Frontend) + Railway/Heroku (Backend)

**Frontend on Vercel:**
1. Install Vercel CLI: `npm install -g vercel`
2. `cd frontend && vercel`
3. Configure API proxy in `vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-api-url.com/api/:path*"
       }
     ]
   }
   ```

**Backend on Railway/Heroku:**
- Deploy backend separately (see above)
- Update frontend API_BASE if needed

### Option 3: Docker Deployment

1. **Create Dockerfile for Backend**

   `backend/Dockerfile`:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   RUN npm run init-db
   EXPOSE 3001
   CMD ["node", "server.js"]
   ```

2. **Create Dockerfile for Frontend**

   `frontend/Dockerfile`:
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. **Create docker-compose.yml**

   ```yaml
   version: '3.8'
   services:
     backend:
       build: ./backend
       ports:
         - "3001:3001"
       volumes:
         - ./backend/database:/app/database
         - ./backend/uploads:/app/uploads
       environment:
         - NODE_ENV=production
         - PORT=3001

     frontend:
       build: ./frontend
       ports:
         - "80:80"
       depends_on:
         - backend
   ```

4. **Deploy**
   ```bash
   docker-compose up -d
   ```

## Important Production Considerations

### 1. Database

**SQLite (Current)**
- Simple, file-based
- Good for small to medium traffic
- Backups: Just copy the `.db` file

**Upgrading to PostgreSQL (Recommended for Production)**
1. Install PostgreSQL on server
2. Create database:
   ```sql
   CREATE DATABASE potterytracker;
   ```
3. Convert schema (modify `backend/database/schema.sql`)
4. Update database connection in `backend/database/init.js`
5. Use `pg` package instead of `sqlite3`

### 2. File Storage

**Current: Local Filesystem**
- Simple but not scalable
- Backup `backend/uploads/` directory
- Consider using cloud storage:

**Upgrading to Cloud Storage (AWS S3, Cloudinary, etc.)**
1. Install storage SDK (e.g., `aws-sdk`, `multer-s3`)
2. Update `backend/middleware/upload.js`
3. Store file URLs in database instead of filenames

### 3. Environment Configuration

Update `frontend/src/services/api.js` if backend URL differs:
```javascript
const API_BASE = process.env.VITE_API_BASE || '/api';
```

Set `VITE_API_BASE` during frontend build if needed.

### 4. Security

- Use environment variables for sensitive data
- **Enable HTTPS/SSL** (see [HTTPS_SETUP.md](./HTTPS_SETUP.md) for detailed instructions)
- Set proper file permissions
- Use CORS configuration for production
- Implement rate limiting
- Add authentication if needed (future enhancement)
- **Secure cookies**: When HTTPS is enabled, backend automatically uses secure cookies

### 5. Monitoring

- Set up logging (Winston, Morgan)
- Monitor server resources
- Set up error tracking (Sentry)
- Database backups (automated)

## Quick Start Deployment Script

For a VPS deployment, here's a quick script:

```bash
#!/bin/bash
# deploy.sh

# Install dependencies
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# Start backend with PM2
cd ../backend
pm2 restart pottery-api || pm2 start server.js --name pottery-api
pm2 save

# Restart nginx
sudo systemctl restart nginx

echo "Deployment complete!"
```

## Troubleshooting

### Backend won't start
- Check Node.js version: `node --version`
- Check port availability: `netstat -tulpn | grep 3001`
- Check logs: `pm2 logs pottery-api` or backend console output

### Images not loading
- Check `backend/uploads/` directory permissions
- Verify file paths in database
- Check nginx/proxy configuration

### Database errors
- Ensure database file exists: `backend/database/database.db`
- Check file permissions
- Run `npm run init-db` again if needed

### CORS errors
- Verify backend CORS settings
- Check API endpoint URLs in frontend

## Post-Deployment

1. Test all functionality:
   - Create/edit pieces
   - Upload images
   - Move pieces between phases (kanban)
   - Manage phases and materials

2. Set up backups:
   - Database file: `backend/database/database.db`
   - Uploads: `backend/uploads/`

3. Monitor:
   - Server resources
   - Application logs
   - Error rates

## Need Help?

- Check server logs
- Review application logs
- Verify file permissions
- Test API endpoints directly: `curl http://localhost:3001/health`

