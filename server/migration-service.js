// Define a map to store migration statuses
const migrations = new Map();

// Import required modules
import https from 'https';
import { decode } from 'base64-arraybuffer';
import yaml from 'js-yaml';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

// Convert exec to promise-based
const exec = promisify(execCallback);

// Function to make Kubernetes API requests with token refresh retry for EKS
async function makeK8sRequestWithRetry(kubeconfig, apiPath, method = 'GET', body = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // First attempt with regular token
      try {
        const clusterEndpoint = getClusterEndpoint(kubeconfig);
        const token = extractK8sAuthToken(kubeconfig);
        const caCert = extractCaCert(kubeconfig);
        const apiUrl = `${clusterEndpoint}${apiPath}`; // Combine endpoint and path

        console.log(`Making K8s ${method} request to ${apiUrl}`);

        const requestOptions = {
          method: method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          rejectUnauthorized: false // Disable for development
        };

        // Add better error handling and logging for debugging
        console.log(`Using token: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);

        const request = https.request(apiUrl, requestOptions, (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', async () => {
            try {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`K8s ${method} request to ${apiPath} successful (Status ${response.statusCode})`);
                
                // For GET requests, parse the response
                if (method === 'GET' && data) {
                  resolve(JSON.parse(data));
                } else {
                  // For POST/PUT/DELETE, just resolve with success
                  resolve({ success: true, statusCode: response.statusCode });
                }
              } else if (response.statusCode === 401) {
                // Authentication failure - try to refresh token if using AWS EKS
                console.error(`Authentication failed (401) for ${apiPath}, attempting to get fresh token`);
                
                try {
                  // Try to extract AWS EKS info
                  const eksInfo = extractAwsEksInfo(kubeconfig);
                  if (eksInfo && eksInfo.clusterName && eksInfo.region) {
                    console.log(`Detected AWS EKS cluster: ${eksInfo.clusterName} in ${eksInfo.region}`);
                    
                    // Try to get a fresh token using aws-cli
                    try {
                      const freshToken = await generateAwsEksToken(eksInfo.clusterName, eksInfo.region);
                      console.log(`Generated fresh token, retrying request with new token`);
                      
                      // Retry with new token (recursive call)
                      const retryResult = await makeK8sRequestWithFreshToken(
                        kubeconfig, 
                        apiPath, 
                        method, 
                        body, 
                        freshToken
                      );
                      resolve(retryResult);
                    } catch (tokenError) {
                      console.error(`Failed to generate fresh token: ${tokenError.message}`);
                      reject({ 
                        statusCode: 401, 
                        error: `Authentication failed and token refresh failed: ${tokenError.message}`,
                        data 
                      });
                    }
                  } else {
                    console.error(`Authentication failed but couldn't find AWS EKS info for token refresh`);
                    reject({ 
                      statusCode: response.statusCode, 
                      error: `Authentication failed: No AWS EKS info available for token refresh`,
                      data 
                    });
                  }
                } catch (eksError) {
                  console.error(`Failed to extract EKS info: ${eksError.message}`);
                  reject({ 
                    statusCode: response.statusCode, 
                    error: `Authentication failed: ${eksError.message}`,
                    data 
                  });
                }
              } else {
                console.error(`Error in K8s ${method} request: Status code ${response.statusCode}`);
                let errorDetails = "Unknown error";
                try {
                  if (data) {
                    const parsedError = JSON.parse(data);
                    errorDetails = parsedError.message || JSON.stringify(parsedError);
                  }
                } catch (e) {
                  errorDetails = data || "No details available";
                }
                
                reject({ 
                  statusCode: response.statusCode, 
                  error: `Request failed with status ${response.statusCode}: ${errorDetails}`, 
                  data: data 
                });
              }
            } catch (parseError) {
              console.error(`Error parsing K8s response for ${apiPath}:`, parseError);
              reject({ statusCode: 500, error: 'Failed to parse K8s response', data: data });
            }
          });
        });

        request.on('error', (error) => {
          console.error(`Error during K8s request to ${apiPath}:`, error);
          reject({ statusCode: 500, error: `Request failed: ${error.message}` });
        });

        // Add the body if it's a POST/PUT request
        if ((method === 'POST' || method === 'PUT') && body) {
          const jsonBody = JSON.stringify(body);
          request.write(jsonBody);
        }

        request.end();
      } catch (initialError) {
        reject({ 
          statusCode: 500, 
          error: `Failed to make initial request: ${initialError.message}` 
        });
      }
    } catch (outerError) {
      console.error(`Outer error in makeK8sRequestWithRetry: ${outerError.message}`);
      reject({ statusCode: 500, error: `Failed to prepare request: ${outerError.message}` });
    }
  });
}

// Helper function to make a request with a fresh token
async function makeK8sRequestWithFreshToken(kubeconfig, apiPath, method, body, freshToken) {
  return new Promise((resolve, reject) => {
    try {
      const clusterEndpoint = getClusterEndpoint(kubeconfig);
      const apiUrl = `${clusterEndpoint}${apiPath}`;

      console.log(`Retrying request to ${apiUrl} with fresh token`);

      const requestOptions = {
        method: method,
        headers: {
          'Authorization': `Bearer ${freshToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
      };

      const request = https.request(apiUrl, requestOptions, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              console.log(`Retry with fresh token succeeded (Status ${response.statusCode})`);
              
              if (method === 'GET' && data) {
                resolve(JSON.parse(data));
              } else {
                resolve({ success: true, statusCode: response.statusCode });
              }
            } else {
              console.error(`Retry with fresh token failed: Status code ${response.statusCode}`);
              reject({ 
                statusCode: response.statusCode, 
                error: `Retry failed with status ${response.statusCode}`,
                data 
              });
            }
          } catch (parseError) {
            reject({ statusCode: 500, error: 'Failed to parse response', data });
          }
        });
      });

      request.on('error', (error) => {
        reject({ statusCode: 500, error: `Retry request failed: ${error.message}` });
      });

      if ((method === 'POST' || method === 'PUT') && body) {
        const jsonBody = JSON.stringify(body);
        request.write(jsonBody);
      }

      request.end();
    } catch (error) {
      reject({ statusCode: 500, error: `Failed to prepare retry request: ${error.message}` });
    }
  });
}

// Helper for extracting AWS EKS info
function extractAwsEksInfo(kubeconfig) {
  try {
    // Try parsing as JSON first
    let config;
    try {
      config = JSON.parse(kubeconfig);
    } catch (jsonError) {
      // If JSON parsing fails, try YAML
      config = yaml.load(kubeconfig);
    }
    
    if (!config || !config.users) {
      return null;
    }
    
    // Find current context and user
    const currentContext = config.currentContext || config['current-context'];
    if (!currentContext) return null;
    
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    if (!context) return null;
    
    const userName = context.context?.user;
    if (!userName) return null;
    
    // Find the user's exec configuration
    const user = config.users?.find(u => u.name === userName);
    if (!user || !user.user?.exec) return null;
    
    const exec = user.user.exec;
    // Check if this is an AWS EKS configuration
    if (exec.command !== 'aws' || !exec.args || !exec.args.includes('eks') || !exec.args.includes('get-token')) {
      return null;
    }
    
    // Extract cluster name and region
    let clusterName, region;
    
    // Extract from args
    const clusterNameIndex = exec.args.indexOf('--cluster-name');
    if (clusterNameIndex !== -1 && clusterNameIndex + 1 < exec.args.length) {
      clusterName = exec.args[clusterNameIndex + 1];
    }
    
    const regionIndex = exec.args.indexOf('--region');
    if (regionIndex !== -1 && regionIndex + 1 < exec.args.length) {
      region = exec.args[regionIndex + 1];
    }
    
    return { clusterName, region };
  } catch (error) {
    console.error(`Error extracting AWS EKS info: ${error.message}`);
    return null;
  }
}

// Generate a fresh AWS EKS token
async function generateAwsEksToken(clusterName, region) {
  try {
    console.log(`Generating fresh AWS EKS token for ${clusterName} in ${region}`);
    
    // Use promisified exec instead of require
    const command = `aws eks get-token --cluster-name ${clusterName} --region ${region} --output json`;
    
    const { stdout, stderr } = await exec(command);
    
    if (stderr) {
      console.warn(`AWS CLI stderr: ${stderr}`);
    }
    
    const result = JSON.parse(stdout);
    if (result.status && result.status.token) {
      const token = result.status.token;
      console.log(`Generated fresh AWS EKS token: ${token.substring(0, 10)}...`);
      return token;
    } else {
      throw new Error('No token found in AWS CLI output');
    }
  } catch (error) {
    console.error(`Failed to generate AWS EKS token: ${error.message}`);
    throw error;
  }
}

// Helper to get cluster endpoint from kubeconfig
function getClusterEndpoint(kubeconfig) {
  try {
    // Try parsing as JSON first
    try {
      const config = JSON.parse(kubeconfig);
      
      const currentContext = config.currentContext || config['current-context'];
      const context = config.contexts?.find(ctx => ctx.name === currentContext);
      
      if (!context) throw new Error('Context not found');
      
      const clusterName = context.context.cluster;
      const cluster = config.clusters?.find(c => c.name === clusterName);
      
      if (!cluster) throw new Error('Cluster not found');
      
      return cluster.cluster.server;
    } catch (jsonError) {
      // If JSON parsing fails, try YAML
      const config = yaml.load(kubeconfig);
      
      const currentContext = config.currentContext || config['current-context'];
      const context = config.contexts?.find(ctx => ctx.name === currentContext);
      
      if (!context) throw new Error('Context not found');
      
      const clusterName = context.context.cluster;
      const cluster = config.clusters?.find(c => c.name === clusterName);
      
      if (!cluster) throw new Error('Cluster not found');
      
      return cluster.cluster.server;
    }
  } catch (error) {
    throw new Error(`Unable to parse kubeconfig: ${error.message}`);
  }
}

// Helper to extract token from kubeconfig (simplified version)
function extractK8sAuthToken(kubeconfig) {
  try {
    // Check for environment variables first
    const envToken = process.env.VITE_K8S_AUTH_TOKEN || process.env.K8S_AUTH_TOKEN;
    if (envToken) {
      return envToken.trim();
    }

    // Try parsing as JSON first
    let config;
    try {
      config = JSON.parse(kubeconfig);
    } catch (jsonError) {
      // If JSON parsing fails, try YAML
      config = yaml.load(kubeconfig);
    }
    
    const currentContext = config.currentContext || config['current-context'];
    if (!currentContext) {
      throw new Error('No current context found in kubeconfig');
    }
    
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    if (!context) {
      throw new Error(`Context "${currentContext}" not found in kubeconfig`);
    }
    
    const userName = context.context?.user;
    if (!userName) {
      throw new Error('No user specified in current context');
    }
    
    const user = config.users?.find(u => u.name === userName);
    if (!user) {
      throw new Error(`User "${userName}" not found in kubeconfig`);
    }
    
    // Check for static token
    if (user.user?.token) {
      return user.user.token.trim();
    }
    
    throw new Error('No valid token found in kubeconfig');
  } catch (error) {
    // If any error occurs, defer to the proxy's token extraction
    throw new Error(`Token extraction failed: ${error.message}`);
  }
}

// Helper to extract CA certificate from kubeconfig (simplified)
function extractCaCert(kubeconfig) {
  try {
    // Try parsing as JSON first
    let config;
    try {
      config = JSON.parse(kubeconfig);
    } catch (jsonError) {
      // If JSON parsing fails, try YAML
      config = yaml.load(kubeconfig);
    }
    
    const currentContext = config.currentContext || config['current-context'];
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    
    if (!context) return null;
    
    const clusterName = context.context.cluster;
    const cluster = config.clusters?.find(c => c.name === clusterName);
    
    if (!cluster || !cluster.cluster['certificate-authority-data']) return null;
    
    return cluster.cluster['certificate-authority-data'];
  } catch (error) {
    return null;
  }
}

// Define performMigration function 
async function performMigration(migrationId, sourceKubeconfig, targetKubeconfig, resources, options) {
  console.log(`Starting real migration for ${migrationId} with ${resources.length} resources`);
  
  // Create an initial migration status object
  const migrationStatus = {
    id: migrationId,
    status: 'in-progress',
    progress: 0,
    resourcesTotal: resources.length,
    resourcesMigrated: 0,
    resourcesFailed: 0,
    completedResources: [],
    failedResources: [],
    logs: [
      { timestamp: new Date(), level: 'info', message: 'Migration started' }
    ],
    isSimulated: false,
    warning: null
  };
  
  // Store the initial migration status
  migrations.set(migrationId, migrationStatus);
  
  try {
    // Add log entry for starting the extraction
    migrationStatus.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Extracting resources from source cluster'
    });
    
    // Process each resource
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      const { kind, name, namespace } = resource;
      
      try {
        // Update progress
        migrationStatus.progress = Math.floor((i / resources.length) * 100);
        
        // Log the current resource being processed
        migrationStatus.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: `Processing ${kind}/${namespace}/${name}`
        });
        
        // Step 1: Get the resource definition from the source cluster
        const apiPath = determineResourceApiPath(kind, namespace, name);
        if (!apiPath) {
          throw new Error(`Unsupported resource kind: ${kind}`);
        }
        
        // Make request to source cluster to get the resource
        const resourceDefinition = await makeK8sRequestWithRetry(sourceKubeconfig, apiPath);
        
        // Step 2: Clean the resource definition for migration
        const cleanedResource = cleanResourceForMigration(resourceDefinition);
        
        // Step 3: Apply the resource to the target cluster
        migrationStatus.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: `Applying ${kind}/${namespace}/${name} to target cluster`
        });
        
        // Create API path for the target cluster (for POST request)
        const targetApiPath = determineResourceApiPathForCreation(kind, namespace);
        if (!targetApiPath) {
          throw new Error(`Cannot determine API path for ${kind}`);
        }
        
        // Create the resource in the target cluster
        await makeK8sRequestWithRetry(targetKubeconfig, targetApiPath, 'POST', cleanedResource);
        
        // Mark resource as completed
        migrationStatus.completedResources.push({
          kind,
          name,
          namespace,
          apiVersion: cleanedResource.apiVersion
        });
        
        migrationStatus.resourcesMigrated++;
        
        // Log success
        migrationStatus.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: `Successfully migrated ${kind}/${namespace}/${name}`
        });
      } catch (resourceError) {
        // Handle resource migration failure
        migrationStatus.resourcesFailed++;
        migrationStatus.failedResources.push({
          kind,
          name,
          namespace,
          error: resourceError.message
        });
        
        // Log the error
        migrationStatus.logs.push({
          timestamp: new Date(),
          level: 'error',
          message: `Failed to migrate ${kind}/${namespace}/${name}: ${resourceError.message}`
        });
      }
    }
    
    // Update final status
    migrationStatus.status = 'completed';
    migrationStatus.progress = 100;
    
    // Add final log entry
    migrationStatus.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Migration completed with ${migrationStatus.resourcesMigrated} resources migrated and ${migrationStatus.resourcesFailed} failures`
    });
    
    if (migrationStatus.resourcesFailed > 0) {
      migrationStatus.warning = `Migration completed with ${migrationStatus.resourcesFailed} resource failures. See logs for details.`;
    }
    
    // Store the updated migration status
    migrations.set(migrationId, migrationStatus);
    return migrationStatus;
  } catch (error) {
    console.error(`Migration ${migrationId} failed with error:`, error);
    
    // Update status for failure
    migrationStatus.status = 'failed';
    migrationStatus.progress = 100; // Mark as complete even though it failed
    
    // Add failure log
    migrationStatus.logs.push({
      timestamp: new Date(),
      level: 'error',
      message: `Migration failed: ${error.message}`
    });
    
    migrationStatus.warning = `Migration process failed: ${error.message}`;
    
    // Store the updated migration status
    migrations.set(migrationId, migrationStatus);
    return migrationStatus;
  }
}

// Helper function to clean resource for migration
function cleanResourceForMigration(resource) {
  // Create a deep copy of the resource
  const cleanedResource = JSON.parse(JSON.stringify(resource));
  
  // Remove fields that should not be included in the migration
  if (cleanedResource.metadata) {
    // Remove fields generated by Kubernetes
    delete cleanedResource.metadata.resourceVersion;
    delete cleanedResource.metadata.uid;
    delete cleanedResource.metadata.selfLink;
    delete cleanedResource.metadata.creationTimestamp;
    delete cleanedResource.metadata.generation;
    delete cleanedResource.metadata.managedFields;
    
    // Remove cluster-specific annotations
    if (cleanedResource.metadata.annotations) {
      const annotations = cleanedResource.metadata.annotations;
      Object.keys(annotations).forEach(key => {
        if (key.startsWith('kubectl.kubernetes.io/') || 
            key.startsWith('kubernetes.io/') ||
            key.includes('kubernetes.io/')) {
          delete annotations[key];
        }
      });
      
      // If no annotations left, remove the annotations object
      if (Object.keys(annotations).length === 0) {
        delete cleanedResource.metadata.annotations;
      }
    }
  }
  
  // Remove status field
  delete cleanedResource.status;
  
  return cleanedResource;
}

// Helper function to determine API path for resource creation
function determineResourceApiPathForCreation(kind, namespace) {
  const kindToApiPath = {
    'Deployment': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/deployments` : 
      `/apis/apps/v1/deployments`,
    'Service': namespace ? 
      `/api/v1/namespaces/${namespace}/services` : 
      `/api/v1/services`,
    'ConfigMap': namespace ? 
      `/api/v1/namespaces/${namespace}/configmaps` : 
      `/api/v1/configmaps`,
    'Secret': namespace ? 
      `/api/v1/namespaces/${namespace}/secrets` : 
      `/api/v1/secrets`,
    'Pod': namespace ? 
      `/api/v1/namespaces/${namespace}/pods` : 
      `/api/v1/pods`,
    'PersistentVolumeClaim': namespace ? 
      `/api/v1/namespaces/${namespace}/persistentvolumeclaims` : 
      `/api/v1/persistentvolumeclaims`,
    'StatefulSet': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/statefulsets` : 
      `/apis/apps/v1/statefulsets`,
    'DaemonSet': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/daemonsets` : 
      `/apis/apps/v1/daemonsets`,
    'Job': namespace ? 
      `/apis/batch/v1/namespaces/${namespace}/jobs` : 
      `/apis/batch/v1/jobs`,
    'CronJob': namespace ? 
      `/apis/batch/v1/namespaces/${namespace}/cronjobs` : 
      `/apis/batch/v1/cronjobs`,
    'Ingress': namespace ? 
      `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses` : 
      `/apis/networking.k8s.io/v1/ingresses`,
    'NetworkPolicy': namespace ? 
      `/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies` : 
      `/apis/networking.k8s.io/v1/networkpolicies`,
    'Namespace': `/api/v1/namespaces`
  };
  
  return kindToApiPath[kind] || null;
}

// Helper function to determine the API path for getting a resource
function determineResourceApiPath(kind, namespace, name) {
  const kindToApiPath = {
    'Deployment': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}` : 
      `/apis/apps/v1/deployments/${name}`,
    'Service': namespace ? 
      `/api/v1/namespaces/${namespace}/services/${name}` : 
      `/api/v1/services/${name}`,
    'ConfigMap': namespace ? 
      `/api/v1/namespaces/${namespace}/configmaps/${name}` : 
      `/api/v1/configmaps/${name}`,
    'Secret': namespace ? 
      `/api/v1/namespaces/${namespace}/secrets/${name}` : 
      `/api/v1/secrets/${name}`,
    'Pod': namespace ? 
      `/api/v1/namespaces/${namespace}/pods/${name}` : 
      `/api/v1/pods/${name}`,
    'PersistentVolumeClaim': namespace ? 
      `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${name}` : 
      `/api/v1/persistentvolumeclaims/${name}`,
    'StatefulSet': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/statefulsets/${name}` : 
      `/apis/apps/v1/statefulsets/${name}`,
    'DaemonSet': namespace ? 
      `/apis/apps/v1/namespaces/${namespace}/daemonsets/${name}` : 
      `/apis/apps/v1/daemonsets/${name}`,
    'Job': namespace ? 
      `/apis/batch/v1/namespaces/${namespace}/jobs/${name}` : 
      `/apis/batch/v1/jobs/${name}`,
    'CronJob': namespace ? 
      `/apis/batch/v1/namespaces/${namespace}/cronjobs/${name}` : 
      `/apis/batch/v1/cronjobs/${name}`,
    'Ingress': namespace ? 
      `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}` : 
      `/apis/networking.k8s.io/v1/ingresses/${name}`,
    'NetworkPolicy': namespace ? 
      `/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies/${name}` : 
      `/apis/networking.k8s.io/v1/networkpolicies/${name}`,
    'Namespace': `/api/v1/namespaces/${name}`
  };
  
  return kindToApiPath[kind] || null;
}

// Process the migration with robust error handling
async function processMigration(migrationId, sourceKubeconfig, targetKubeconfig, resources, options) {
  try {
    console.log(`Starting migration of ${resources.length} resources`);
    
    // Check if AWS CLI is available for any AWS-specific operations
    try {
      // Use promisified exec from the top of the file instead of require
      const { stdout } = await exec('aws --version');
      console.log('AWS CLI is available:', stdout.trim());
    } catch (error) {
      console.log('AWS CLI not available, some AWS-specific features may not work');
      throw new Error('AWS CLI is required for migration but is not available');
    }
    
    // Proceed with real migration - simulation mode completely disabled
    return await performMigration(migrationId, sourceKubeconfig, targetKubeconfig, resources, options);
    
  } catch (error) {
    console.error(`Migration ${migrationId} failed:`, error);
    
    // Create a failed migration status (not simulated)
    const migrationStatus = {
      id: migrationId,
      status: 'failed',
      progress: 0,
      resourcesTotal: resources.length,
      resourcesMigrated: 0,
      resourcesFailed: resources.length,
      completedResources: [],
      failedResources: resources.map(r => ({
        kind: r.kind,
        name: r.name,
        namespace: r.namespace,
        error: error.message
      })),
      logs: [
        { timestamp: new Date(), level: 'error', message: `Migration failed: ${error.message}` }
      ],
      error: error.message
    };
    
    // Store the migration status
    migrations.set(migrationId, migrationStatus);
    return migrationStatus;
  }
}

// Helper function to get API version for a kind if not provided
function getApiVersionForKind(kind) {
  const kindToApiVersion = {
    'Deployment': 'apps/v1',
    'Service': 'v1',
    'ConfigMap': 'v1',
    'Secret': 'v1',
    'Pod': 'v1',
    'PersistentVolumeClaim': 'v1',
    'PersistentVolume': 'v1',
    'Namespace': 'v1',
    'StatefulSet': 'apps/v1',
    'DaemonSet': 'apps/v1',
    'Job': 'batch/v1',
    'CronJob': 'batch/v1',
    'Ingress': 'networking.k8s.io/v1',
    'NetworkPolicy': 'networking.k8s.io/v1',
    'ServiceAccount': 'v1',
    'ClusterRole': 'rbac.authorization.k8s.io/v1',
    'ClusterRoleBinding': 'rbac.authorization.k8s.io/v1',
    'Role': 'rbac.authorization.k8s.io/v1',
    'RoleBinding': 'rbac.authorization.k8s.io/v1'
  };
  
  return kindToApiVersion[kind] || 'v1'; // Default to v1 if unknown
}

// Endpoint to initiate migration
function setupMigrationEndpoint(app) {
  app.post('/kube-migrate/k8s/migrate', async (req, res) => {
    console.log('Handling /kube-migrate/k8s/migrate request');
    
    const { sourceKubeconfig, targetKubeconfig, resources, options, migrationId } = req.body;
    
    if (!sourceKubeconfig || !targetKubeconfig || !resources || !resources.length) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Use the client-provided migration ID if available, otherwise generate one
    const migrationJobId = migrationId || `migration-${Date.now()}`;
    console.log(`Starting migration of ${resources.length} resources`);
    
    try {
      // Process the migration
      const migrationStatus = await processMigration(migrationJobId, sourceKubeconfig, targetKubeconfig, resources, options || {});
      
      // Respond with success and the migration ID
      return res.json({ 
        status: 'success', 
        migrationId: migrationJobId,
        message: 'Migration started successfully'
      });
    } catch (error) {
      console.error(`Migration failed to start: ${error.message}`);
      
      // Return actual error to client
      return res.status(500).json({
        status: 'error',
        error: `Migration failed to start: ${error.message}`
      });
    }
  });
  
  // Migration status endpoint
  app.get('/kube-migrate/k8s/migration/:id/status', (req, res) => {
    const { id } = req.params;
    const migrationId = id.startsWith('migration-') ? id : `migration-${id}`;
    
    console.log(`Checking status for migration: ${migrationId}`);
    
    // Get the migration status from the map
    const migrationStatus = migrations.get(migrationId);
    
    if (!migrationStatus) {
      console.log(`No migration found with ID: ${migrationId}`);
      return res.status(404).json({
        error: `No migration found with ID: ${migrationId}`,
        status: 'error'
      });
    }
    
    console.log(`Returning status for migration: ${migrationId}`);
    return res.json(migrationStatus);
  });
  
  // Alternative endpoint for migration status
  app.get('/kube-migrate/migrations/:id/status', (req, res) => {
    const { id } = req.params;
    const migrationId = id.startsWith('migration-') ? id : `migration-${id}`;
    
    // Get the migration status from the map
    const migrationStatus = migrations.get(migrationId);
    
    if (!migrationStatus) {
      console.log(`No migration found with ID: ${migrationId} in migrations/${id}/status endpoint`);
      return res.status(404).json({
        error: `No migration found with ID: ${migrationId}`,
        status: 'error'
      });
    }
    
    return res.json(migrationStatus);
  });
  
  // Another alternative endpoint for migration status
  app.get('/kube-migrate/migration/:id/status', (req, res) => {
    const { id } = req.params;
    const migrationId = id.startsWith('migration-') ? id : `migration-${id}`;
    
    // Get the migration status from the map
    const migrationStatus = migrations.get(migrationId);
    
    if (!migrationStatus) {
      console.log(`No migration found with ID: ${migrationId} in migration/:id/status endpoint`);
      return res.status(404).json({
        error: `No migration found with ID: ${migrationId}`,
        status: 'error'
      });
    }
    
    return res.json(migrationStatus);
  });
}

// Export all the functions using ES module format
export { 
  setupMigrationEndpoint, 
  migrations, 
  processMigration, 
  performMigration, 
  getApiVersionForKind 
}; 