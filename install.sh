#!/bin/bash
# Production installation script for Kube-Migrate application

# Stop on any error
set -e

echo "Starting Kube-Migrate production installation..."

# Install required dependencies if not already installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js installed: $(node -v)"
else
    echo "Node.js is already installed: $(node -v)"
fi

if ! command -v npm &> /dev/null; then
    echo "npm not found. Installing..."
    sudo apt-get install -y npm
    echo "npm installed: $(npm -v)"
else
    echo "npm is already installed: $(npm -v)"
fi

if ! command -v nginx &> /dev/null; then
    echo "nginx not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y nginx
    echo "nginx installed: $(nginx -v 2>&1)"
else
    echo "nginx is already installed: $(nginx -v 2>&1)"
fi

# Configure application directory
APP_DIR="/opt/kube-migrate"
if [ -d "$APP_DIR" ]; then
    echo "Application directory already exists. Backing up..."
    BACKUP_DIR="$APP_DIR-backup-$(date +%Y%m%d-%H%M%S)"
    sudo mv "$APP_DIR" "$BACKUP_DIR"
    echo "Backed up existing installation to $BACKUP_DIR"
fi

echo "Creating application directory at $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown $(whoami):$(whoami) "$APP_DIR"

# Clone repository and install dependencies
echo "Cloning repository..."
git clone https://github.com/yourusername/cluster-migrate-magic.git "$APP_DIR"
cd "$APP_DIR"

echo "Installing dependencies..."
npm install --production

# Create production environment file
echo "Creating production environment file..."
cat > .env.production << EOF
# Deployment environment
DEPLOYMENT=production

# Application ports
FRONTEND_PORT=3009
BACKEND_PORT=8089

# Kubernetes API proxy settings with path prefix
VITE_K8S_PROXY_URL=/kube-migrate
VITE_API_PROXY_URL=/kube-migrate
VITE_USE_MOCK_K8S_DATA=false

# AWS configuration
VITE_AWS_REGION=us-east-1

# AWS Cognito configuration
VITE_COGNITO_USER_POOL_ID=us-east-1_0phCrx0Ao
VITE_COGNITO_CLIENT_ID=4qfs9mvg1phde56htj0d3b3ku9
VITE_DYNAMODB_REGION=us-east-1

# Server configuration
PORT=8089
NODE_ENV=production
EOF

# Build the application
echo "Building application..."
npm run build

# Configure startup script
echo "Creating startup script..."
cat > start-app.sh << EOF
#!/bin/bash
# Production startup script for Kube-Migrate application

# Set environment variables
export NODE_ENV=production
export DEPLOYMENT=production
export PORT=8089
export BACKEND_PORT=8089
export FRONTEND_PORT=3009

# Change to application directory
cd "\$(dirname "\$0")"

# Start the application
node server/proxy.js
EOF

chmod +x start-app.sh

# Create systemd service
echo "Creating systemd service..."
sudo bash -c "cat > /etc/systemd/system/kube-migrate.service << EOF
[Unit]
Description=Kube Migrate Application
After=network.target

[Service]
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/start-app.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kube-migrate
Environment=NODE_ENV=production
Environment=DEPLOYMENT=production
Environment=PORT=8089
Environment=BACKEND_PORT=8089
Environment=FRONTEND_PORT=3009

[Install]
WantedBy=multi-user.target
EOF"

# Configure nginx
echo "Configuring nginx..."
sudo bash -c "cat > /etc/nginx/conf.d/kube-migrate.conf << EOF
# Configuration for Kube-Migrate application
location /kube-migrate/ {
    proxy_pass http://127.0.0.1:8089/;
    proxy_redirect off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 0;
}
EOF"

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Enable and start services
echo "Enabling and starting services..."
sudo systemctl enable kube-migrate
sudo systemctl start kube-migrate
sudo systemctl reload nginx

echo "Installation complete!"
echo "Kube-Migrate is now accessible at https://your-domain.com/kube-migrate"
echo "Check service status with: sudo systemctl status kube-migrate"
echo "View logs with: sudo journalctl -u kube-migrate -f" 