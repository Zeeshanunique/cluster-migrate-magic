// API endpoints management
const API_BASE_URL = 'http://localhost:3001';

// Kubernetes API endpoints
export const KUBERNETES_API = {
  // Endpoints for Kubernetes operations
  
  // Namespace section
  GET_NAMESPACES: `${API_BASE_URL}/api/k8s/namespaces`,
  
  // Node section
  GET_NODES: `${API_BASE_URL}/api/k8s/nodes`,
  
  // Workloads section
  GET_PODS: `${API_BASE_URL}/api/k8s/pods`,
  GET_POD_YAML: `${API_BASE_URL}/api/k8s/pod-yaml`,
  GET_DEPLOYMENTS: `${API_BASE_URL}/api/k8s/deployments`,
  GET_REPLICASETS: `${API_BASE_URL}/api/k8s/replicasets`,
  GET_STATEFULSETS: `${API_BASE_URL}/api/k8s/statefulsets`,
  GET_DAEMONSETS: `${API_BASE_URL}/api/k8s/daemonsets`,
  GET_JOBS: `${API_BASE_URL}/api/k8s/jobs`,
  GET_CRONJOBS: `${API_BASE_URL}/api/k8s/cronjobs`,
  
  // Networking section
  GET_SERVICES: `${API_BASE_URL}/api/k8s/services`,
  GET_INGRESSES: `${API_BASE_URL}/api/k8s/ingresses`,
  
  // Configurations section
  GET_CONFIGMAPS: `${API_BASE_URL}/api/k8s/configmaps`,
  GET_SECRETS: `${API_BASE_URL}/api/k8s/secrets`,
  GET_RESOURCE_QUOTAS: `${API_BASE_URL}/api/k8s/resourcequotas`,
  GET_LIMIT_RANGES: `${API_BASE_URL}/api/k8s/limitranges`,
  
  // Storage section
  GET_PERSISTENT_VOLUMES: `${API_BASE_URL}/api/k8s/persistentvolumes`,
  GET_PERSISTENT_VOLUME_CLAIMS: `${API_BASE_URL}/api/k8s/persistentvolumeclaims`,
  GET_STORAGE_CLASSES: `${API_BASE_URL}/api/k8s/storageclasses`,
  
  // Monitoring & Logging
  GET_METRICS: `${API_BASE_URL}/api/k8s/metrics`,
  GET_LOGS: `${API_BASE_URL}/api/k8s/logs`,
  
  // Debug and utility
  DEBUG_TOKEN: `${API_BASE_URL}/api/k8s/debug/token`,
  GET_KUBECONFIG_DETAILS: `${API_BASE_URL}/api/k8s/kubeconfig-details`,
};

// Helper function to make API requests to the proxy server
export const apiRequest = async (
  endpoint: string, 
  method: 'GET' | 'POST' = 'POST',
  body?: any
) => {
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

export default {
  KUBERNETES_API,
  apiRequest
};
