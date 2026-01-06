# HTTPS Setup Guide for PotteryTracker

This guide walks you through setting up HTTPS with Let's Encrypt SSL certificates for PotteryTracker on Ubuntu.

## Prerequisites

- Ubuntu server (tested on Ubuntu 24)
- Domain name pointing to your server (e.g., `subdomain.yourdomain.com` or `yourdomain.com`)
- Nginx installed and configured
- Ports 80 and 443 open in your firewall
- Root or sudo access

## Quick Setup

### Step 1: Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Update Nginx Configuration

1. **On your Ubuntu server** (via SSH), first ensure you've pulled the latest code:

```bash
# Navigate to your PotteryTracker installation directory
cd /srv/PotteryTracker  # or wherever you installed it

# Make sure you're on the feature/force-https branch (or main if merged)
git fetch origin
git checkout feature/force-https  # or main if you've merged
git pull origin feature/force-https
```

2. Copy the Nginx configuration template from your repo to the Nginx sites-available directory:

```bash
# Copy from your project directory to Nginx config location
sudo cp nginx/potterytracker.conf /etc/nginx/sites-available/potterytracker
```

**Note**: This command runs on your server. The `nginx/potterytracker.conf` file should be in your git repository on the server (after pulling).

**Alternative**: If you prefer to copy from your local Windows machine to the server:
```bash
# From your LOCAL Windows machine (PowerShell or Git Bash)
scp nginx/potterytracker.conf user@your-server-ip:/tmp/potterytracker.conf

# Then on the server:
sudo mv /tmp/potterytracker.conf /etc/nginx/sites-available/potterytracker
```

3. **IMPORTANT**: Edit the configuration file to match your setup:

```bash
sudo nano /etc/nginx/sites-available/potterytracker
```

Update these values:
- `server_name`: Should match your domain (e.g., `subdomain.yourdomain.com` or `yourdomain.com`)
- `root` path in the `location /` block: Update to your frontend/dist path (e.g., `/srv/PotteryTracker/frontend/dist`)
- `proxy_pass` port: Update if your backend uses a different port (default: 3001)

4. Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/potterytracker /etc/nginx/sites-enabled/
```

5. Test the configuration:

```bash
sudo nginx -t
```

If the test passes, reload Nginx:

```bash
sudo systemctl reload nginx
```

### Step 3: Obtain SSL Certificate

Run certbot to automatically obtain and configure the certificate:

```bash
sudo certbot --nginx -d subdomain.yourdomain.com
```

Replace `subdomain.yourdomain.com` with your actual domain name.

Certbot will:
- Obtain a Let's Encrypt SSL certificate
- Automatically update your Nginx configuration with certificate paths
- Set up automatic renewal

**Follow the prompts:**
- Enter your email address (for renewal reminders)
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### Step 4: Update Backend Environment Variables

Set the `HTTPS_ENABLED` environment variable in your backend `.env` file:

```bash
cd /srv/PotteryTracker/backend  # or wherever your backend is
nano .env
```

Add or update:

```env
HTTPS_ENABLED=true
NODE_ENV=production
```

Then restart your backend:

```bash
pm2 restart pottery-api
# or whatever your PM2 process name is
```

### Step 5: Verify SSL Certificate Renewal

Let's Encrypt certificates expire every 90 days. Certbot automatically sets up renewal, but verify it works:

```bash
sudo certbot renew --dry-run
```

If successful, you'll see a message confirming the renewal would work.

## Verification

After setup, verify everything works:

1. **Check HTTP redirect**: Visit `http://yourdomain.com` - it should redirect to HTTPS
2. **Check HTTPS**: Visit `https://yourdomain.com` - you should see a valid SSL certificate
3. **Check browser console**: Open developer tools and verify no mixed content warnings
4. **Test login**: Verify authentication works correctly (cookies should be secure)

## Troubleshooting

### Certificate Request Fails

**Problem**: Certbot fails with "Failed to obtain certificate" or DNS errors

**Solutions**:
1. Verify DNS is properly configured:
   ```bash
   dig yourdomain.com
   ```
   Should show your server's IP address

2. Ensure port 80 is accessible:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. Check Nginx is running:
   ```bash
   sudo systemctl status nginx
   ```

### Redirect Loop

**Problem**: Browser shows redirect loop error

**Solutions**:
1. Check `X-Forwarded-Proto` header is being set correctly in Nginx config
2. Verify backend has `app.set('trust proxy', 1)` in server.js
3. Check Nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Cookies Not Working

**Problem**: Login fails or sessions don't persist

**Solutions**:
1. Verify `HTTPS_ENABLED=true` in backend `.env`
2. Check browser console for cookie errors
3. Ensure cookies are being sent:
   - Open browser DevTools → Application → Cookies
   - Verify cookies have `Secure` flag checked
4. Check backend logs:
   ```bash
   pm2 logs pottery-api
   ```

### Mixed Content Warnings

**Problem**: Browser shows "mixed content" warnings

**Solutions**:
- Ensure all API calls use relative URLs (they should: `/api/...`)
- Check that images are served over HTTPS
- Verify no hardcoded `http://` URLs in frontend code

## Advanced Configuration

### Custom SSL Settings

After certbot runs, you can customize SSL settings in the Nginx config:

```nginx
# Modern SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
```

### HSTS (HTTP Strict Transport Security)

The configuration includes HSTS header. To adjust the max-age:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Certificate Auto-Renewal

Certbot sets up automatic renewal via systemd timer. Check status:

```bash
sudo systemctl status certbot.timer
```

View renewal logs:

```bash
sudo journalctl -u certbot.timer
sudo journalctl -u certbot.service
```

## Security Best Practices

1. **Keep Certbot Updated**:
   ```bash
   sudo apt update && sudo apt upgrade certbot
   ```

2. **Monitor Certificate Expiry**:
   ```bash
   sudo certbot certificates
   ```

3. **Test Renewal Regularly**:
   ```bash
   sudo certbot renew --dry-run
   ```

4. **Firewall Configuration**:
   - Only open ports 80 (HTTP) and 443 (HTTPS)
   - Close all other unnecessary ports

5. **Regular Backups**:
   - Backup your Nginx configuration
   - Backup SSL certificates (though they can be regenerated)

## Rollback to HTTP

If you need to rollback to HTTP (not recommended for production):

1. Comment out the HTTPS server block in Nginx config
2. Remove the HTTP redirect from the HTTP server block
3. Set `HTTPS_ENABLED=false` in backend `.env`
4. Reload Nginx and restart backend

## Support

For issues:
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Check backend logs: `pm2 logs pottery-api`
- Check certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`
- Verify DNS: `dig yourdomain.com`

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)

