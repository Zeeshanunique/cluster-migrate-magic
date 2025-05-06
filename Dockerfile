# Multi-stage build for Kubernetes Cluster Migration tool
# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Fix Express version compatibility issue
RUN npm uninstall express && npm install express@4.18.2 --save

# Build the frontend for production
RUN npm run build:prod

# Stage 2: Set up the server
FROM node:18-alpine

WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Fix Express version compatibility issue
RUN npm uninstall express && npm install express@4.18.2 --save

# Install curl for health checks
RUN apk --no-cache add curl

# Copy server files
COPY server/ ./server/

# Copy built frontend files to the correct location
COPY --from=frontend-builder /app/dist ./dist

# Copy environment files
COPY .env.production .env

# Expose the ports the server will run on
EXPOSE 8089

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8089
ENV FRONTEND_PORT=3009
ENV BACKEND_PORT=8089
ENV DEPLOYMENT=production

# Add a simple health check script
RUN echo '#!/bin/sh\nif curl -f http://localhost:$PORT/health > /dev/null 2>&1; then\n  exit 0\nelse\n  exit 1\nfi' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["/app/healthcheck.sh"]

# Start the server
CMD ["node", "server/proxy.js"]
