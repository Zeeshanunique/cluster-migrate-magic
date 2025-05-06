#!/bin/bash
# Complete deployment script for Kube-Migrate (Frontend + Backend)
# This script handles building and deploying both the frontend and backend components

# Stop on any error
set -e

echo "Starting Kube-Migrate deployment..."

# Configuration
APP_NAME="kube-migrate"
DEPLOY_DIR="/opt/$APP_NAME"
NGINX_CONF="/etc/nginx/conf.d/$APP_NAME.conf"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
BACKEND_PORT=8089
FRONTEND_PORT=3009

# Check if running as root or with sudo privileges
if [ "$(id -u)" -ne 0 ]; then
    echo "This script requires root privileges. Please run with sudo."
    exit 1
fi

# Install required dependencies if not already installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    echo "Node.js installed: $(node -v)"
else
    echo "Node.js is already installed: $(node -v)"
fi

if ! command -v nginx &> /dev/null; then
    echo "nginx not found. Installing..."
    apt-get update
    apt-get install -y nginx
    echo "nginx installed: $(nginx -v 2>&1)"
else
    echo "nginx is already installed: $(nginx -v 2>&1)"
fi

# Create backup if deploying to existing installation
if [ -d "$DEPLOY_DIR" ]; then
    echo "Backup existing installation..."
    BACKUP_DIR="${DEPLOY_DIR}-backup-$(date +%Y%m%d-%H%M%S)"
    mv "$DEPLOY_DIR" "$BACKUP_DIR"
    echo "Backed up to $BACKUP_DIR"
fi

# Create deployment directory
echo "Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"

# Copy all application files to deployment directory
echo "Copying application files..."
CURRENT_DIR=$(pwd)
cp -r "$CURRENT_DIR"/* "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Fix Express version compatibility issue (downgrade to 4.x)
echo "Fixing Express version compatibility..."
npm uninstall express
npm install express@4.18.2 --save

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build frontend
echo "Building frontend..."
npm run build:prod

# Create .env file from .env.production
echo "Setting up environment..."
cp .env.production .env

# Set up systemd service
echo "Creating systemd service..."
cat > "$SERVICE_FILE" << EOL
[Unit]
Description=Kube Migrate Application
After=network.target

[Service]
User=root
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/node $DEPLOY_DIR/server/proxy.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME
Environment=NODE_ENV=production
Environment=DEPLOYMENT=production
Environment=PORT=$BACKEND_PORT
Environment=BACKEND_PORT=$BACKEND_PORT
Environment=FRONTEND_PORT=$FRONTEND_PORT

[Install]
WantedBy=multi-user.target
EOL

# Configure nginx
echo "Configuring nginx..."
cat > "$NGINX_CONF" << EOL
# Kube-Migrate Frontend + Backend Configuration
server {
    listen 80;
    listen [::]:80;
    server_name _;  # Replace with your server name if needed

    # Frontend static files
    location /kube-migrate/ {
        alias $DEPLOY_DIR/dist/;
        try_files \$uri \$uri/ /kube-migrate/index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Backend API proxy
    location /kube-migrate/api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/;
        proxy_redirect off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 0;
    }
}
EOL

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Enable and start services
echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable $APP_NAME
systemctl restart $APP_NAME
systemctl reload nginx

echo "Deployment complete!"
echo "Application is accessible at http://YOUR_SERVER_IP/kube-migrate/"
echo "Check service status: systemctl status $APP_NAME"
echo "View logs: journalctl -u $APP_NAME -f" 