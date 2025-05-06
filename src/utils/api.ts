// API endpoints management
// Get port from environment variables with fallback to 8089
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 8089;
export const API_BASE_URL = `http://localhost:${BACKEND_PORT}`;

// Kubernetes API endpoints
export const KUBERNETES_API = {
  // Endpoints for Kubernetes operations
  
  // Namespace section
  GET_NAMESPACES: `${API_BASE_URL}/kube-migrate/k8s/namespaces`,
  
  // Node section
  GET_NODES: `${API_BASE_URL}/kube-migrate/k8s/nodes`,
  
  // Workloads section
  GET_PODS: `${API_BASE_URL}/kube-migrate/k8s/pods`,
  GET_POD_YAML: `${API_BASE_URL}/kube-migrate/k8s/pod-yaml`,
  GET_DEPLOYMENTS: `${API_BASE_URL}/kube-migrate/k8s/deployments`,
  GET_REPLICASETS: `${API_BASE_URL}/kube-migrate/k8s/replicasets`,
  GET_STATEFULSETS: `${API_BASE_URL}/kube-migrate/k8s/statefulsets`,
  GET_DAEMONSETS: `${API_BASE_URL}/kube-migrate/k8s/daemonsets`,
  GET_JOBS: `${API_BASE_URL}/kube-migrate/k8s/jobs`,
  GET_CRONJOBS: `${API_BASE_URL}/kube-migrate/k8s/cronjobs`,
  
  // Networking section
  GET_SERVICES: `${API_BASE_URL}/kube-migrate/k8s/services`,
  GET_INGRESSES: `${API_BASE_URL}/kube-migrate/k8s/ingresses`,
  
  // Configurations section
  GET_CONFIGMAPS: `${API_BASE_URL}/kube-migrate/k8s/configmaps`,
  GET_SECRETS: `${API_BASE_URL}/kube-migrate/k8s/secrets`,
  GET_RESOURCE_QUOTAS: `${API_BASE_URL}/kube-migrate/k8s/resourcequotas`,
  GET_LIMIT_RANGES: `${API_BASE_URL}/kube-migrate/k8s/limitranges`,
  
  // Storage section
  GET_PERSISTENT_VOLUMES: `${API_BASE_URL}/kube-migrate/k8s/persistentvolumes`,
  GET_PERSISTENT_VOLUME_CLAIMS: `${API_BASE_URL}/kube-migrate/k8s/persistentvolumeclaims`,
  GET_STORAGE_CLASSES: `${API_BASE_URL}/kube-migrate/k8s/storageclasses`,
  
  // Monitoring & Logging
  GET_METRICS: `${API_BASE_URL}/kube-migrate/k8s/metrics`,
  GET_LOGS: `${API_BASE_URL}/kube-migrate/k8s/logs`,
  
  // Debug and utility
  DEBUG_TOKEN: `${API_BASE_URL}/kube-migrate/debug/validate-token`,
  GET_KUBECONFIG_DETAILS: `${API_BASE_URL}/kube-migrate/k8s/kubeconfig-details`,
  
  // Migration utilities
  GENERATE_YAML: `${API_BASE_URL}/kube-migrate/k8s/generate-yaml`,
  MIGRATE_RESOURCES: `${API_BASE_URL}/kube-migrate/k8s/migrate`,
  MIGRATION_STATUS: `${API_BASE_URL}/kube-migrate/k8s/migration`,
  
  // Real migration endpoints
  MIGRATION_START: `${API_BASE_URL}/kube-migrate/migrations/start`,
  MIGRATION_STATUS_CHECK: (id: string) => `${API_BASE_URL}/kube-migrate/migrations/${id}/status`,
  MIGRATION_CANCEL: (id: string) => `${API_BASE_URL}/kube-migrate/migrations/${id}/cancel`,
  
  // Multi-tenant specific endpoints
  TENANT_NAMESPACES: `${API_BASE_URL}/kube-migrate/k8s/tenant/namespaces`,
  TENANT_PODS: `${API_BASE_URL}/kube-migrate/k8s/tenant/pods`,
  TENANT_DEPLOYMENTS: `${API_BASE_URL}/kube-migrate/k8s/tenant/deployments`,
  TENANT_RESOURCE_USAGE: `${API_BASE_URL}/kube-migrate/k8s/tenant/resource-usage`,
};

// List of endpoints in development that aren't fully implemented yet
const DEVELOPMENT_ENDPOINTS = [
  '/kube-migrate/k8s/namespaces',
  '/kube-migrate/k8s/nodes',
  '/kube-migrate/k8s/pods',
  '/kube-migrate/k8s/deployments',
  '/kube-migrate/k8s/replicasets',
  '/kube-migrate/k8s/statefulsets',
  '/kube-migrate/k8s/daemonsets',
  '/kube-migrate/k8s/jobs',
  '/kube-migrate/k8s/cronjobs',
  '/kube-migrate/k8s/services',
  '/kube-migrate/k8s/ingresses',
  '/kube-migrate/k8s/configmaps',
  '/kube-migrate/k8s/secrets',
  '/kube-migrate/k8s/resourcequotas',
  '/kube-migrate/k8s/limitranges',
  '/kube-migrate/k8s/persistentvolumes',
  '/kube-migrate/k8s/persistentvolumeclaims',
  '/kube-migrate/k8s/storageclasses',
  '/kube-migrate/k8s/metrics',
  '/kube-migrate/k8s/logs',
  '/kube-migrate/debug/validate-token',
  // Add tenant endpoints to development endpoints
  '/kube-migrate/k8s/tenant/namespaces',
  '/kube-migrate/k8s/tenant/pods',
  '/kube-migrate/k8s/tenant/deployments',
  '/kube-migrate/k8s/tenant/resource-usage',
];

// Helper function to make API requests to the proxy server
export const apiRequest = async (
  endpoint: string, 
  method: 'GET' | 'POST' = 'POST',
  body?: any
) => {
  // Check if this is a development endpoint that might return 404
  const isDevelopmentEndpoint = DEVELOPMENT_ENDPOINTS.some(devEndpoint => 
    endpoint.includes(devEndpoint)
  );

  let finalEndpoint = endpoint;
  let fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (method === 'GET' && body) {
    // For GET requests, append only non-kubeconfig parameters as query string
    const params = new URLSearchParams();
    if (body.namespace) {
      params.append('namespace', body.namespace);
    }
    // Append other potential body parameters (excluding kubeconfig)
    Object.keys(body).forEach(key => {
      if (key !== 'kubeconfig' && key !== 'namespace') {
        params.append(key, typeof body[key] === 'object' ? JSON.stringify(body[key]) : String(body[key]));
      }
    });

    const queryString = params.toString();
    if (queryString) {
      finalEndpoint = `${endpoint}?${queryString}`;
    }
    // Remove body and Content-Type header for GET requests
    fetchOptions.body = undefined;
    delete fetchOptions.headers?.[`Content-Type` as keyof HeadersInit];

  } else if (method === 'POST' && body) {
    // Validate kubeconfig format if it's included
    if (body.kubeconfig) {
      try {
        // Basic validation - ensure it's a string and has expected fields
        if (typeof body.kubeconfig !== 'string') {
          console.error('kubeconfig must be a string, got:', typeof body.kubeconfig);
        } else {
          const kubeconfigSample = body.kubeconfig.substring(0, 100);
          console.log('First 100 chars of kubeconfig:', kubeconfigSample);
          
          // Log if it doesn't look like valid YAML
          if (!kubeconfigSample.includes('apiVersion') && !kubeconfigSample.includes('clusters:')) {
            console.warn('kubeconfig doesn\'t appear to be valid YAML. It should contain fields like apiVersion, clusters, etc.');
          }
        }
      } catch (error) {
        console.error('Error validating kubeconfig:', error);
      }
    }
    
    // For POST requests, stringify the full body
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    console.log(`Making ${method} request to: ${finalEndpoint}`);
    
    const response = await fetch(finalEndpoint, fetchOptions);
    
    if (!response.ok) {
      // For 404 errors on development endpoints, log a detailed message but still throw an error
      if (response.status === 404 && isDevelopmentEndpoint) {
        console.error(`Development endpoint ${finalEndpoint} returned 404. Check if backend server is running and has this route implemented.`);
        console.error(`Body sent:`, body ? JSON.stringify(body).substring(0, 100) + '...' : 'None');
        
        // Throw a more descriptive error
        throw new Error(`API endpoint not implemented: ${response.status} ${response.statusText} for ${finalEndpoint}`);
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText} for ${finalEndpoint}`);
    }

    let data;
    try {
      data = await response.json();
      console.log(`Response from ${finalEndpoint}:`, data ? JSON.stringify(data).substring(0, 100) + '...' : 'Empty response');
      
      // Check if data is empty or missing items
      if (isDevelopmentEndpoint && (!data || (Array.isArray(data.items) && data.items.length === 0))) {
        console.warn(`Endpoint ${finalEndpoint} returned empty data or no items.`);
      }
      
      return data;
    } catch (jsonError) {
      console.error(`Error parsing JSON from ${finalEndpoint}:`, jsonError);
      throw new Error(`Invalid JSON response from server: ${jsonError.message}`);
    }
  } catch (error) {
    // Log the full error with stack trace
    console.error(`API Request Error for ${finalEndpoint}:`, error);
    
    // For development endpoints, provide a more comprehensive error message
    if (isDevelopmentEndpoint) {
      console.info(`This is a development endpoint and might not be fully implemented yet. Check the backend.`);
    }
    
    // Rethrow all errors to be handled by the calling component
    throw error;
  }
};

// Add a specific function for multi-tenant API requests
export const apiTenantRequest = async (
  cluster: any,
  endpoint: string, 
  method: 'GET' | 'POST' = 'POST',
  additionalParams?: any
) => {
  console.log(`[apiTenantRequest] Starting request to ${endpoint} for cluster ${cluster?.name}`);
  
  if (!cluster?.kubeconfig) {
    console.error('[apiTenantRequest] Missing kubeconfig');
    throw new Error('Missing kubeconfig for multi-tenant request');
  }

  if (cluster.type !== 'tenant') {
    console.warn(`[apiTenantRequest] Called with non-tenant cluster type: ${cluster.type}`);
  }

  // For tenant requests, we must use POST and include the kubeconfig
  const body = {
    kubeconfig: cluster.kubeconfig,
    ...additionalParams
  };

  console.log(`[apiTenantRequest] Making request to ${endpoint} with method ${method}`);
  
  try {
    // Use the regular apiRequest function with our tenant endpoint
    const result = await apiRequest(endpoint, 'POST', body);
    console.log(`[apiTenantRequest] Request to ${endpoint} successful`);
    return result;
  } catch (error) {
    console.error(`[apiTenantRequest] Error in request to ${endpoint}:`, error);
    throw error;
  }
};

export default {
  KUBERNETES_API,
  apiRequest,
  apiTenantRequest
};
