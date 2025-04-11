# Cluster Migration Tool

A web application for managing and migrating Kubernetes clusters, with integrated connectivity to AWS EKS clusters.

## Features

- **Dashboard** for managing all your Kubernetes clusters
- **Live Monitoring** of cluster nodes, pods, and resource usage
- **Migration Wizard** for converting single clusters to multi-tenant clusters
- **Integrated connectivity** with AWS EKS clusters
- **Support for standard kubeconfig files** in any format

## Setup and Installation

### Frontend

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Connecting to AWS EKS Clusters

This application supports connectivity to AWS EKS clusters through:

1. **Standard kubeconfig files**: Upload your kubeconfig file in the application
2. **Direct integration**: Your cluster information is parsed and handled directly within the application

## Development Mode

The application now includes integrated Kubernetes cluster discovery, without requiring a separate server component.

For development without a real cluster:

1. Set `VITE_USE_MOCK_K8S_DATA=true` in your `.env` file
2. The application will use realistic simulated data based on your kubeconfig

## Production Deployment

For production deployment:

1. Build the frontend:
   ```bash
   npm run build
   ```
2. Deploy the frontend to your hosting service

## Future Enhancements

To implement true direct Kubernetes API access:
1. Add a lightweight WASM-based library for Kubernetes client functionality
2. Implement client-side certificate handling for authentication
3. Address CORS limitations with appropriate configuration on your clusters

## License

This project is licensed under the MIT License - see the LICENSE file for details.
