# Cluster Migration Magic

A powerful web application for managing, monitoring, and migrating Kubernetes clusters, with seamless integration for AWS EKS clusters. This tool provides a comprehensive interface for cluster management, resource visualization, and efficient migration between single-tenant and multi-tenant configurations.

## Features

- **Comprehensive Dashboard** for managing all your Kubernetes clusters in one place
- **Live Monitoring** of cluster health, nodes, pods, and resource usage metrics
- **Migration Wizard** for seamlessly converting single clusters to multi-tenant configurations
- **Integrated Connectivity** with AWS EKS clusters and standard Kubernetes deployments
- **Support for Standard Kubeconfig Files** in any format
- **Hierarchical Resource Management** following standard Kubernetes organization:
  - Namespaces management
  - Node visualization and metrics
  - Workloads (Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs)
  - Networking (Services, Ingress)
  - Configurations (ConfigMaps, Secrets, ResourceQuotas, LimitRanges)
  - Storage (PVs, PVCs, StorageClasses)
  - ClusterInfo (version, API endpoints, authentication)
  - Monitoring & Logging integration

## Prerequisites

- Node.js 16.x or later
- npm 8.x or later
- Access to a Kubernetes cluster (or use mock data for development)
- AWS CLI configured (for AWS EKS integration)
- For production: EC2 instance with appropriate IAM role attached

## Setup and Installation

### Complete Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cluster-migrate-magic.git
   cd cluster-migrate-magic
   ```

2. Install dependencies for both frontend and server:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file to configure your environment variables
   # Recommended editor: nano, vim, or your preferred text editor
   nano .env
   ```

4. Key environment variables to configure:
   ```
   # Deployment environment
   DEPLOYMENT=local
   
   # Application ports
   FRONTEND_PORT=3009
   BACKEND_PORT=8089
   
   # Frontend configuration
   VITE_K8S_PROXY_URL=http://localhost:8089
   VITE_API_PROXY_URL=http://localhost:8089
   VITE_USE_MOCK_K8S_DATA=false  # Set to true for development without a real cluster
   
   # AWS credentials (for local development)
   VITE_AWS_ACCESS_KEY_ID=your_access_key_id
   VITE_AWS_SECRET_ACCESS_KEY=your_secret_access_key
   VITE_AWS_REGION=us-east-1
   
   # Cognito configuration
   VITE_COGNITO_USER_POOL_ID=your_user_pool_id
   VITE_COGNITO_CLIENT_ID=your_client_id
   VITE_DYNAMODB_REGION=us-east-1
   ```

## Running the Application

### Development Mode

1. Start the application in development mode:
   ```bash
   npm run dev
   ```

2. Access the application:
   - Frontend: http://localhost:3009
   - Backend API: http://localhost:8089

## Production Deployment

### Automated Deployment

For a streamlined deployment, you can use our automated installation script:

```bash
# Make the script executable
chmod +x install.sh

# Run the installation script (requires sudo privileges)
sudo ./install.sh
```

This script will:
- Install all required dependencies
- Set up the application in /opt/kube-migrate
- Configure environment variables for production
- Create a systemd service for automatic startup
- Configure nginx with the /kube-migrate path prefix
- Start the application

### Manual Step-by-Step Deployment Guide

#### 1. Prepare the EC2 Instance

1. Launch an EC2 instance with the following:
   - Amazon Linux 2 or Ubuntu Server
   - At least 2GB RAM and 2 vCPUs
   - An IAM role attached with these permissions:
     - AmazonCognitoReadOnly
     - AmazonDynamoDBFullAccess (or more restricted access as needed)
     - AmazonEKSClusterPolicy (if connecting to EKS clusters)

2. Install required dependencies:
   ```bash
   # For Amazon Linux
   sudo yum update -y
   sudo yum install -y git nodejs npm nginx

   # For Ubuntu
   sudo apt update
   sudo apt install -y git nodejs npm nginx
   ```

#### 2. Deploy the Application

1. Clone the repository on the EC2 instance:
   ```bash
   git clone https://github.com/yourusername/cluster-migrate-magic.git
   cd cluster-migrate-magic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the production environment file:
   ```bash
   nano .env.production
   ```

4. Add the following configuration to `.env.production`:
   ```
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
   VITE_COGNITO_USER_POOL_ID=your_user_pool_id
   VITE_COGNITO_CLIENT_ID=your_client_id
   VITE_DYNAMODB_REGION=us-east-1
   
   # Server configuration
   PORT=8089
   NODE_ENV=production
   ```

5. Build the application:
   ```bash
   npm run build
   ```

#### 3. Configure Application Service

1. Create a startup script:
   ```bash
   nano start-app.sh
   ```

2. Add the following content to the script:
   ```bash
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
   ```

3. Make the script executable:
   ```bash
   chmod +x start-app.sh
   ```

4. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/kube-migrate.service
   ```

5. Add the following content to the service file:
   ```
   [Unit]
   Description=Kube Migrate Application
   After=network.target

   [Service]
   User=ec2-user
   WorkingDirectory=/path/to/cluster-migrate-magic
   ExecStart=/path/to/cluster-migrate-magic/start-app.sh
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
   ```

6. Enable and start the service:
   ```bash
   sudo systemctl enable kube-migrate
   sudo systemctl start kube-migrate
   ```

#### 4. Configure NGINX as Reverse Proxy

1. Create an NGINX configuration file:
   ```bash
   sudo nano /etc/nginx/conf.d/kube-migrate.conf
   ```

2. Add the following configuration:
   ```nginx
   server {
       listen 443 ssl;
       listen [::]:443 ssl;
       server_name your-domain.com;

       ssl_certificate /etc/nginx/ssl/your-certificate.pem;
       ssl_certificate_key /etc/nginx/ssl/your-key.key;
       ssl_protocols TLSv1.2;

       # Other existing location blocks...

       location /kube-migrate/ {
           proxy_pass http://127.0.0.1:8089/;
           proxy_redirect off;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
           proxy_http_version 1.1;
           proxy_set_header Host $http_host;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 0;
       }
   }
   ```

3. Test the NGINX configuration:
   ```bash
   sudo nginx -t
   ```

4. Reload NGINX to apply changes:
   ```bash
   sudo systemctl reload nginx
   ```

### Docker Deployment

For container-based deployment:

```bash
# Using Docker directly
docker build -t kube-migrate:latest .
docker run -p 8089:8089 -d --name kube-migrate kube-migrate:latest

# OR using Docker Compose
docker-compose up -d
```

The Docker deployment automatically sets all necessary environment variables for production mode and IAM role usage.

#### 5. AWS Credentials Configuration

The application automatically detects the deployment environment and uses the appropriate AWS credential source:

- **In local development**: Uses AWS Access Key and Secret Key from environment variables
- **In production**: Uses the IAM Role attached to the EC2 instance

No additional configuration is needed if you've set `DEPLOYMENT=production` in your environment file and attached the correct IAM role to your EC2 instance.

#### 6. Verify Deployment

1. Access the application at:
   ```
   https://your-domain.com/kube-migrate
   ```

2. Check if the application is correctly using the EC2 instance IAM role:
   ```bash
   sudo journalctl -u kube-migrate | grep "IAM Role"
   ```
   
   You should see a message like:
   ```
   Using IAM Role from EC2 instance for AWS authentication
   ```

3. Check application logs for any errors:
   ```bash
   sudo journalctl -u kube-migrate -f
   ```

### Troubleshooting Production Deployment

1. If the application fails to connect to AWS services:
   - Verify IAM role is correctly attached to the EC2 instance
   - Check the IAM role has the necessary permissions
   - Ensure `DEPLOYMENT=production` is set in the environment

2. If nginx proxy isn't working:
   - Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
   - Verify the nginx configuration passes validation: `sudo nginx -t`
   - Make sure the application is running on port 8089: `netstat -tulpn | grep 8089`

3. If paths don't work correctly:
   - Check that `VITE_K8S_PROXY_URL=/kube-migrate` is set in production environment
   - Verify the trailing slash in nginx proxy_pass configuration
   - Restart the application service: `sudo systemctl restart kube-migrate`

## API Endpoints

The application uses the following API endpoint pattern:

```
/kube-migrate/k8s/...
```

All API endpoints previously using `/api/` now use `/kube-migrate/` as the base path.

Main API categories:

- `/kube-migrate/k8s/nodes` - Retrieve node information
- `/kube-migrate/k8s/pods` - Retrieve pod information
- `/kube-migrate/k8s/persistentvolumes` - Retrieve persistent volume information
- `/kube-migrate/k8s/tenant/...` - Multi-tenant resource endpoints
- `/kube-migrate/debug/...` - Debugging and validation endpoints

## Connecting to Kubernetes Clusters

This application supports connectivity to Kubernetes clusters through multiple methods:

1. **Standard kubeconfig files**: Upload your kubeconfig file through the application UI
2. **Environment-based configuration**: Set the `KUBECONFIG_PATH` in your environment
3. **Direct AWS EKS integration**: Connect using AWS credentials and region information
4. **In-cluster configuration**: When deployed inside a Kubernetes cluster with appropriate service account

## Development Options

### Using Mock Data

For development without a real Kubernetes cluster:

1. Set `VITE_USE_MOCK_K8S_DATA=true` in your `.env` file
2. The application will use realistic simulated data that mimics actual cluster resources
3. The mock data follows the same structure as real Kubernetes resources

### Running Tests

```bash
# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e

# Run with coverage reporting
npm run test:coverage
```

## Project Structure

The project follows a modular architecture with clear separation of concerns:

```
/src
  /components       # React components
  /hooks            # Custom React hooks
  /utils            # Utility functions
  /services         # API services
  /styles           # Global styles
  /types            # TypeScript type definitions
  /kubernetes       # Kubernetes interfaces (organized by resource types)
    /namespaces
    /nodes
    /workloads      # Pods, Deployments, ReplicaSets, etc.
    /networking     # Services, Ingress
    /configurations # ConfigMaps, Secrets, etc.
    /storage        # PVs, PVCs, StorageClasses
    /clusterInfo    # Cluster metadata
    /monitoring     # Monitoring and logging interfaces

/server             # Backend server code
  /endpoints        # API endpoints
  /services         # Server-side services
  /kubernetes       # Kubernetes client integration
  /proxy.js         # API proxy for Kubernetes
```

## Support

- GitHub Issues: [https://github.com/yourusername/cluster-migrate-magic/issues](https://github.com/yourusername/cluster-migrate-magic/issues)
- Documentation: See the `docs/` directory for detailed documentation

## License

This project is licensed under the MIT License - see the LICENSE file for details.
