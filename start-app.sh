#!/bin/bash
# Production startup script for Kube-Migrate application

# Set environment variables
export NODE_ENV=production
export DEPLOYMENT=production
export PORT=8089
export BACKEND_PORT=8089
export FRONTEND_PORT=3009

# Change to application directory
cd "$(dirname "$0")"

# Start the application
node server/proxy.js 