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
   # Frontend configuration
   VITE_API_BASE_URL=http://localhost:3001
   VITE_USE_MOCK_K8S_DATA=false  # Set to true for development without a real cluster
   
   # Server configuration
   PORT=3001
   NODE_ENV=development
   KUBECONFIG_PATH=/path/to/your/kubeconfig  # Optional, can also upload via UI
   ```

## Running the Application

### Development Mode

1. Start the server in one terminal:
   ```bash
   # Start the server component
   npm run server:dev
   ```

2. Start the frontend in another terminal:
   ```bash
   # Start the frontend development server
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - Server API: http://localhost:3001

### Production Mode

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server (serves both frontend and API):
   ```bash
   npm run start
   ```

3. Access the production application at http://localhost:3001

### Using Docker

```bash
# Build the Docker image
docker build -t cluster-migrate-magic .

# Run the container
docker run -p 3001:3001 -v /path/to/kubeconfig:/app/kubeconfig cluster-migrate-magic
```

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

### Hot Module Replacement

The development server supports hot module replacement for rapid development:

```bash
# Start with HMR enabled
npm run dev
```

### Running Tests

```bash
# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e

# Run with coverage reporting
npm run test:coverage
```

## Production Deployment

### Standard Deployment

1. Build the application:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm run start
   ```

### Cloud Deployment

The application can be deployed to various cloud services:

#### AWS Deployment

```bash
# Deploy to AWS Elastic Beanstalk
npm run deploy:aws
```

#### Kubernetes Deployment

```bash
# Apply the Kubernetes manifests
kubectl apply -f deployment/
```

#### Environment-Specific Configuration

For production deployments, ensure these environment variables are set:

```
NODE_ENV=production
PORT=3001
KUBECONFIG_PATH=/path/to/kubeconfig  # If using a file-based configuration
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

## Future Enhancements

### Planned Features

1. **Direct Kubernetes API Access**:
   - Implement a lightweight WASM-based library for Kubernetes client functionality
   - Add client-side certificate handling for secure authentication
   - Address CORS limitations with appropriate proxy configuration

2. **Enhanced Multi-Tenant Support**:
   - Advanced resource isolation between tenants
   - Tenant-specific monitoring and alerting
   - Custom RBAC profiles for tenant administrators

3. **Integration with Additional Cloud Providers**:
   - Google GKE support
   - Azure AKS integration
   - Digital Ocean Kubernetes

### Contribution Guidelines

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Connection to Kubernetes cluster fails**:
   - Verify your kubeconfig is valid with `kubectl get nodes`
   - Check that your cluster API is accessible from your network
   - Ensure proper credentials are configured

2. **Server fails to start**:
   - Check for port conflicts on 3001
   - Verify all dependencies are installed
   - Check the server logs for specific error messages

3. **Mock data not loading**:
   - Verify `VITE_USE_MOCK_K8S_DATA=true` is set in your `.env`
   - Restart the application after changing environment variables

## Support

- GitHub Issues: [https://github.com/yourusername/cluster-migrate-magic/issues](https://github.com/yourusername/cluster-migrate-magic/issues)
- Documentation: See the `docs/` directory for detailed documentation

## License

This project is licensed under the MIT License - see the LICENSE file for details.
