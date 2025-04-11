// API endpoints management
const API_BASE_URL = 'http://localhost:3001';

// Kubernetes API endpoints
export const KUBERNETES_API = {
  // Endpoints for Kubernetes operations
  GET_NODES: `${API_BASE_URL}/api/k8s/nodes`,
  GET_PODS: `${API_BASE_URL}/api/k8s/pods`,
  GET_POD_YAML: `${API_BASE_URL}/api/k8s/pod-yaml`,
  DEBUG_TOKEN: `${API_BASE_URL}/api/debug/token`,
  GET_NAMESPACES: `${API_BASE_URL}/api/k8s/namespaces`,
  GET_SERVICES: `${API_BASE_URL}/api/k8s/services`,
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
