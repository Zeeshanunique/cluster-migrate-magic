# Multi-stage build for Kubernetes Cluster Migration tool
# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Build the frontend
RUN npm run build:prod

# Stage 2: Set up the server
FROM node:18-alpine AS server-builder

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy server files
COPY server/ ./server/

# Stage 3: Final image
FROM node:18-alpine

WORKDIR /app

# Copy built frontend from first stage
COPY --from=frontend-builder /app/dist ./dist

# Copy server from second stage
COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/node_modules ./node_modules

# Copy package.json and other necessary files
COPY package.json .
COPY .env.production .env

# Expose the ports the server will run on
EXPOSE 8089

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8089
ENV FRONTEND_PORT=3009
ENV BACKEND_PORT=8089
ENV DEPLOYMENT=production

# Start the server
CMD ["node", "server/proxy.js"]
