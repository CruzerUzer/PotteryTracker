# Deploying PotteryTracker on WSL and Making it Internet-Accessible

This guide covers deploying PotteryTracker on Windows Subsystem for Linux (WSL) and making it accessible from the internet.

## Prerequisites

1. WSL installed (WSL2 recommended)
2. A Linux distribution installed (Ubuntu recommended)
3. Windows with administrator access
4. A static public IP address OR use a service like ngrok for testing

## Step 1: Install WSL and Ubuntu (if not already installed)

```powershell
# In PowerShell as Administrator
wsl --install
```

After installation, restart your computer and Ubuntu will launch automatically.

## Step 2: Update WSL and Install Node.js

Open Ubuntu terminal:

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

## Step 3: Clone/Copy Your Project to WSL

### Option A: If project is on Windows

```bash
# Access Windows files from WSL
cd /mnt/c/Users/AdamFaris/Documents/Programmering/PotteryTracker

# Or copy to WSL home directory
cp -r /mnt/c/Users/AdamFaris/Documents/Programmering/PotteryTracker ~/PotteryTracker
cd ~/PotteryTracker
```

### Option B: Clone from GitHub

```bash
# Install git if not already installed
sudo apt install -y git

# Clone your repository
cd ~
git clone https://github.com/CruzerUzer/PotteryTracker.git
cd PotteryTracker
```

## Step 4: Set Up Backend

```bash
cd backend

# Install dependencies
npm install

# Initialize database
npm run init-db

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Test the backend (press Ctrl+C to stop)
npm start
```

## Step 5: Set Up Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Build for production
npm run build
```

## Step 6: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/potterytracker
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    # Frontend static files
    location / {
        root /home/YOUR_USERNAME/PotteryTracker/frontend/dist;
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

    # Serve images directly (optional, can also proxy)
    location /api/images {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

**Replace:**
- `YOUR_USERNAME` with your WSL username (run `whoami` to find it)
- `your-domain.com` with your domain name or use `_` for any domain

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/potterytracker /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo service nginx restart
```

## Step 7: Start Backend with PM2

```bash
cd ~/PotteryTracker/backend

# Start the backend server
pm2 start server.js --name pottery-api

# Save PM2 configuration to start on boot
pm2 save

# Setup PM2 to start on WSL boot
pm2 startup
# Follow the instructions it prints
```

## Step 8: Configure Windows Firewall

In PowerShell as Administrator:

```powershell
# Allow HTTP (port 80)
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Allow HTTPS (port 443) if using SSL
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# Allow backend port (optional, for direct access)
New-NetFirewallRule -DisplayName "PotteryTracker API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

## Step 9: Port Forwarding (Making it Internet-Accessible)

### Option A: Using Router Port Forwarding (Home Network)

1. **Find your router's IP address:**
   ```bash
   # In WSL
   ip route show | grep -i default | awk '{ print $3}'
   # Or check in Windows: ipconfig -> Default Gateway
   ```

2. **Access router admin panel:**
   - Usually at `http://192.168.1.1` or `http://192.168.0.1`
   - Login with admin credentials

3. **Set up port forwarding:**
   - External Port: 80 (HTTP) or 443 (HTTPS)
   - Internal IP: Your Windows machine's IP (check with `ipconfig` in PowerShell)
   - Internal Port: 80 (where Nginx is listening)
   - Protocol: TCP

4. **Find your public IP:**
   ```bash
   curl ifconfig.me
   ```
   Access your app at: `http://YOUR_PUBLIC_IP`

### Option B: Using ngrok (Quick Testing - Recommended for Development)

```bash
# Install ngrok
cd ~
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin

# Sign up at https://ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start ngrok tunnel
ngrok http 80
```

This will give you a public URL like: `https://abc123.ngrok.io`

### Option C: Using Cloudflare Tunnel (Free, Permanent)

```bash
# Install cloudflared
cd ~
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Login to Cloudflare
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create potterytracker

# Create config file
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add to config.yml:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:80
  - service: http_status:404
```

Run tunnel:
```bash
cloudflared tunnel run potterytracker
```

## Step 10: Set Up SSL/HTTPS (Recommended)

Using Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx
# Certificates auto-renew via cron job
```

**Note:** For SSL to work, you need:
- A domain name pointing to your public IP
- Port 80 and 443 open and forwarded

## Step 11: Auto-start Services on WSL Boot

Create a startup script:

```bash
nano ~/start-potterytracker.sh
```

Add:

```bash
#!/bin/bash
cd ~/PotteryTracker/backend
pm2 resurrect
cd ~
ngrok http 80 &  # If using ngrok
```

Make executable:

```bash
chmod +x ~/start-potterytracker.sh
```

Add to `~/.bashrc`:

```bash
echo '~/start-potterytracker.sh' >> ~/.bashrc
```

## Step 12: Access Your Application

### Local Access (from Windows):
```
http://localhost
```

### Network Access (same network):
```
http://YOUR_WINDOWS_IP
```

### Internet Access:
- **Router port forwarding:** `http://YOUR_PUBLIC_IP`
- **ngrok:** `https://YOUR_NGROK_URL.ngrok.io`
- **Cloudflare Tunnel:** `https://your-domain.com`
- **Domain with SSL:** `https://your-domain.com`

## Troubleshooting

### Check if services are running:

```bash
# Check PM2 status
pm2 status

# Check Nginx status
sudo service nginx status

# Check if ports are listening
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3001
```

### View logs:

```bash
# PM2 logs
pm2 logs pottery-api

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart services:

```bash
# Restart backend
pm2 restart pottery-api

# Restart Nginx
sudo service nginx restart
```

### Common Issues:

1. **Port already in use:**
   ```bash
   sudo lsof -i :80
   sudo kill -9 PID
   ```

2. **Permission denied:**
   ```bash
   sudo chown -R $USER:$USER ~/PotteryTracker
   chmod -R 755 ~/PotteryTracker
   ```

3. **Cannot access from internet:**
   - Check Windows Firewall rules
   - Verify router port forwarding
   - Check if your ISP blocks incoming connections (many residential ISPs do)
   - Use ngrok or Cloudflare Tunnel as alternatives

4. **WSL IP changes:**
   - WSL IP can change on restart
   - Use `localhost` in Nginx config, not WSL IP
   - Nginx in WSL can access services via `localhost`

## Security Considerations

1. **Change default passwords** if any
2. **Use HTTPS** (SSL certificates)
3. **Implement authentication** for production use
4. **Regular backups** of database and uploads
5. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade
   ```
6. **Firewall rules:** Only open necessary ports
7. **Rate limiting:** Consider adding rate limiting to API

## Production Recommendations

1. **Use a VPS** instead of home server for better reliability
2. **Set up automatic backups**
3. **Use environment variables** for sensitive data
4. **Implement proper logging**
5. **Set up monitoring** (PM2 has built-in monitoring)
6. **Use a database like PostgreSQL** instead of SQLite for production
7. **Use cloud storage** (S3, etc.) for images instead of local filesystem

## Quick Start Script

Create a complete setup script:

```bash
nano ~/setup-potterytracker.sh
```

```bash
#!/bin/bash
set -e

echo "Setting up PotteryTracker..."

# Install dependencies
cd ~/PotteryTracker/backend
npm install
npm run init-db
mkdir -p uploads
chmod 755 uploads

cd ../frontend
npm install
npm run build

# Start backend
cd ../backend
pm2 start server.js --name pottery-api
pm2 save

echo "Setup complete! Start Nginx and access at http://localhost"
```

Make executable and run:
```bash
chmod +x ~/setup-potterytracker.sh
~/setup-potterytracker.sh
```

