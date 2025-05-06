#!/bin/bash
# Script to set up the production environment for kube-migrate application

# Create .env.production file with production settings
cat > .env.production << EOF
# Kubernetes configuration
# For production - set to "false"
VITE_USE_MOCK_K8S_DATA=false

# Supabase configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Kubernetes API proxy settings
VITE_K8S_PROXY_URL=/kube-migrate

# Deployment environment
DEPLOYMENT=production

# Application ports
FRONTEND_PORT=3009
BACKEND_PORT=8089

# Server configuration
PORT=8089
NODE_ENV=production
EOF

echo "Created .env.production file"

# Check if nginx is installed
if command -v nginx >/dev/null 2>&1; then
    echo "Nginx is installed"
    echo "Adding kube-migrate configuration to nginx..."
    # Create nginx configuration file
    cat > /tmp/kube-migrate.conf << EOF
location /kube-migrate/ {
    proxy_pass http://127.0.0.1:8089/;
    proxy_redirect off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    client_max_body_size 0;
}
EOF
    echo "Nginx configuration created at /tmp/kube-migrate.conf"
    echo "Please manually add this configuration to your nginx server block"
    echo "Then restart nginx with: sudo systemctl restart nginx"
else
    echo "Nginx is not installed. Please install nginx and configure it manually."
fi

echo "Production setup complete!"
echo "To build the application, run: npm run build:prod"
echo "To start the server, run: npm run start" 