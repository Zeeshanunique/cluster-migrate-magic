#!/bin/bash
# Script to fix Express version compatibility issues on EC2 Linux

# Stop on any error
set -e

echo "Running Express.js version compatibility fix..."

# Check if running as root or with sudo privileges
if [ "$(id -u)" -ne 0 ]; then
    echo "This script requires root privileges. Please run with sudo."
    exit 1
fi

# Stop the service if running
echo "Stopping the kube-migrate service..."
systemctl stop kube-migrate 2>/dev/null || true

# Detect installation directory
if [ -d "/opt/kube-migrate" ]; then
    INSTALL_DIR="/opt/kube-migrate"
elif [ -d "/home/ec2-user/streamlit_dashboard/kube-migrate" ]; then
    INSTALL_DIR="/home/ec2-user/streamlit_dashboard/kube-migrate"
else
    echo "Installation directory not found. Please specify the path:"
    read -p "Installation path: " INSTALL_DIR
fi

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Directory $INSTALL_DIR does not exist. Aborting."
    exit 1
fi

echo "Found installation at $INSTALL_DIR"
cd "$INSTALL_DIR"

# Fix Express version compatibility issue
echo "Downgrading Express.js to version 4.18.2..."
npm uninstall express
npm install express@4.18.2 --save

# Check current version
CURRENT_VERSION=$(npm list express | grep express)
echo "Current Express version: $CURRENT_VERSION"

# Check if package.json was updated correctly
if grep -q "\"express\": \"^4.18.2\"" package.json; then
    echo "package.json updated successfully."
else 
    echo "Warning: package.json doesn't show express@4.18.2. Manual edit may be required."
fi

# Restart the service
echo "Restarting the kube-migrate service..."
systemctl restart kube-migrate || true

# Check service status
echo "Checking service status..."
systemctl status kube-migrate --no-pager

echo "Fix completed. If the service is still failing, please check the logs:"
echo "journalctl -u kube-migrate -f" 