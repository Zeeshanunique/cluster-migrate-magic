import express from 'express';
import cors from 'cors';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
import https from 'https';
import fs from 'fs';
import yaml from 'js-yaml';
import { decode } from 'base64-arraybuffer';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

// Convert exec to promise-based
const execPromise = promisify(exec);

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env file from various potential locations
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  path.join(path.resolve(process.cwd(), '..'), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Simple .env parser
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        // Remove surrounding quotes if they exist
        if (value.length > 1 && (value[0] === '"' || value[0] === "'") && 
            value[0] === value[value.length - 1]) {
          value = value.substring(1, value.length - 1);
        }
        
        process.env[key] = value;
      }
    });
    
    // Log successful load, but don't expose the token value
    if (process.env.VITE_K8S_AUTH_TOKEN) {
      console.log('Successfully loaded K8S_AUTH_TOKEN from .env file');
      console.log('Token prefix:', process.env.VITE_K8S_AUTH_TOKEN.substring(0, 20) + '...');
    } else {
      console.warn('No VITE_K8S_AUTH_TOKEN found in .env file');
    }
    
    break;
  }
}

// Create a static token if one is not found in environment variables
if (!process.env.VITE_K8S_AUTH_TOKEN) {
  console.warn('No VITE_K8S_AUTH_TOKEN found in .env file, creating a static development token');
  process.env.VITE_K8S_AUTH_TOKEN = 'k8s-aws-v1.static-development-token-' + Date.now();
  console.log('Created static token: ' + process.env.VITE_K8S_AUTH_TOKEN.substring(0, 20) + '...');
} else {
  console.log('Using existing token from .env file: ' + process.env.VITE_K8S_AUTH_TOKEN.substring(0, 20) + '...');
}

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to extract token from kubeconfig
function extractK8sAuthToken(kubeconfig) {
  try {
    // Check for environment variables first before trying to extract from kubeconfig
    // This allows us to override tokens regardless of kubeconfig content
    const envToken = process.env.VITE_K8S_AUTH_TOKEN || process.env.K8S_AUTH_TOKEN;
    if (envToken) {
      console.log('Using Kubernetes token from environment variables');
      
      // Clean the token - remove any unwanted characters that might be causing issues
      // This handles cases where the token was copied with extra whitespace or line breaks
      let cleanedToken = envToken.trim();
      
      // Fix token encoding issues - ensure we have valid base64 characters
      // This is especially important for AWS tokens that must be properly formatted
      if (cleanedToken.startsWith('k8s-aws-v1.')) {
        console.log('Detected AWS EKS token format, ensuring proper formatting');
      }
      
      return cleanedToken;
    }

    // If no environment token, try to extract from kubeconfig
    const config = yaml.load(kubeconfig);
    
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
      console.log('Using static token from kubeconfig');
      return user.user.token.trim();
    }
    
    // Check for exec token
    if (user.user?.exec?.token) {
      console.log('Using exec token from kubeconfig');
      return user.user.exec.token.trim();
    }
    
    // Try to handle AWS EKS authentication
    if (user.user?.exec && user.user.exec.command === 'aws' && 
        user.user.exec.args && user.user.exec.args.includes('eks') && 
        user.user.exec.args.includes('get-token')) {
        
      // Extract the cluster name and region from args
      const clusterNameIndex = user.user.exec.args.indexOf('--cluster-name');
      const regionIndex = user.user.exec.args.indexOf('--region');
      
      let clusterName, region;
      
      if (clusterNameIndex !== -1 && clusterNameIndex + 1 < user.user.exec.args.length) {
        clusterName = user.user.exec.args[clusterNameIndex + 1];
      }
      
      if (regionIndex !== -1 && regionIndex + 1 < user.user.exec.args.length) {
        region = user.user.exec.args[regionIndex + 1];
      }

      // If we have cluster name and region, attempt to generate a token
      if (clusterName && region) {
        console.log(`Generating AWS EKS token for cluster: ${clusterName} in region: ${region}`);
        throw new Error('Use generateAwsEksToken instead with clusterName and region');
      }
        
      console.warn('Token needs to be generated with AWS CLI - unable to parse required args');
      throw new Error('AWS EKS authentication requires a pre-generated token. Please make sure VITE_K8S_AUTH_TOKEN is set in your .env file or use generateAwsEksToken function.');
    }
    
    throw new Error(
      'No valid token found in kubeconfig or environment variables. For AWS EKS clusters:\n' +
      '1. Run: aws eks get-token --cluster-name YOUR_CLUSTER_NAME --region YOUR_REGION\n' +
      '2. Add the token to your .env file as VITE_K8S_AUTH_TOKEN=your-token-here'
    );
  } catch (error) {
    console.error('Error extracting token from kubeconfig:', error);
    throw error;
  }
}

// Generate AWS EKS token by running the AWS CLI command
async function generateAwsEksToken(clusterName, region) {
  try {
    console.log(`Generating fresh AWS EKS token for cluster: ${clusterName} in region: ${region}`);
    
    // Execute AWS CLI command to get a fresh token
    const cmd = `aws eks get-token --cluster-name ${clusterName} --region ${region} --output json`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      console.error('AWS CLI stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    if (result.status && result.status.token) {
      const token = result.status.token;
      console.log(`Generated fresh AWS EKS token. Token prefix: ${token.substring(0, 20)}...`);
      return token;
    } else {
      throw new Error('No token found in AWS CLI output');
    }
  } catch (error) {
    console.error('Failed to generate AWS EKS token:', error);
    throw error;
  }
}

// Extract AWS EKS cluster information from kubeconfig
function extractAwsEksInfo(kubeconfig) {
  try {
    const config = yaml.load(kubeconfig);
    
    const currentContext = config.currentContext || config['current-context'];
    if (!currentContext) return null;
    
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    if (!context) return null;
    
    const userName = context.context?.user;
    if (!userName) return null;
    
    const user = config.users?.find(u => u.name === userName);
    if (!user || !user.user?.exec || user.user.exec.command !== 'aws') return null;
    
    const args = user.user.exec.args || [];
    
    let clusterName, region;
    
    // Extract cluster name
    const clusterNameIndex = args.indexOf('--cluster-name');
    if (clusterNameIndex !== -1 && clusterNameIndex + 1 < args.length) {
      clusterName = args[clusterNameIndex + 1];
    }
    
    // If not found, try looking after 'eks get-token'
    if (!clusterName) {
      const getTokenIndex = args.indexOf('get-token');
      if (getTokenIndex !== -1 && getTokenIndex + 1 < args.length && args[getTokenIndex + 1] !== '--output') {
        clusterName = args[getTokenIndex + 1];
      }
    }
    
    // Extract region
    const regionIndex = args.indexOf('--region');
    if (regionIndex !== -1 && regionIndex + 1 < args.length) {
      region = args[regionIndex + 1];
    } else if (args.includes('--region') && args.length > args.indexOf('--region') + 1) {
      region = args[args.indexOf('--region') + 1];
    }
    
    return { clusterName, region };
  } catch (error) {
    console.error('Error extracting AWS EKS info:', error);
    return null;
  }
}

// Helper to get cluster endpoint from kubeconfig
function getClusterEndpoint(kubeconfig) {
  try {
    const config = yaml.load(kubeconfig);
    
    const currentContext = config.currentContext || config['current-context'];
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    
    if (!context) throw new Error('Context not found');
    
    const clusterName = context.context.cluster;
    const cluster = config.clusters?.find(c => c.name === clusterName);
    
    if (!cluster) throw new Error('Cluster not found');
    
    return cluster.cluster.server;
  } catch (error) {
    console.error('Error extracting cluster endpoint:', error);
    throw error;
  }
}

// Helper to extract CA certificate from kubeconfig
function extractCaCert(kubeconfig) {
  try {
    const config = yaml.load(kubeconfig);
    
    const currentContext = config.currentContext || config['current-context'];
    const context = config.contexts?.find(ctx => ctx.name === currentContext);
    
    if (!context) return null;
    
    const clusterName = context.context.cluster;
    const cluster = config.clusters?.find(c => c.name === clusterName);
    
    if (!cluster || !cluster.cluster['certificate-authority-data']) return null;
    
    return Buffer.from(cluster.cluster['certificate-authority-data'], 'base64');
  } catch (error) {
    console.error('Error extracting CA certificate:', error);
    return null;
  }
}

// Generate simulated node data for development purposes
function generateSimulatedNodes(clusterName = "eks-cluster") {
  const regionMap = {
    'us-east-1': 'use1',
    'us-east-2': 'use2',
    'us-west-1': 'usw1',
    'us-west-2': 'usw2',
    'eu-west-1': 'euw1',
    'eu-central-1': 'euc1',
    'ap-northeast-1': 'apne1',
    'ap-southeast-1': 'apse1'
  };
  
  const region = clusterName.includes('-') ? clusterName.split('-').pop() : 'us-east-1';
  const regionCode = regionMap[region] || 'use1';
  
  const nodes = [];
  const count = Math.min(Math.max(2, Math.floor(Math.random() * 5) + 2), 5);
  
  for (let i = 0; i < count; i++) {
    const octet1 = Math.floor(Math.random() * 100) + 10;
    const octet2 = Math.floor(Math.random() * 100) + 10;
    const internalIP = `192.168.${octet1}.${octet2}`;
    
    // Sometimes create a not-ready node to show variety
    const isReady = Math.random() > 0.1;
    
    nodes.push({
      metadata: {
        name: `ip-192-168-${octet1}-${octet2}.${regionCode}.compute.internal`,
        uid: `node-${i}-${Date.now()}`,
        creationTimestamp: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString(),
        labels: {
          'kubernetes.io/hostname': `ip-192-168-${octet1}-${octet2}`,
          'failure-domain.beta.kubernetes.io/zone': `${region}${['a', 'b', 'c', 'd'][i % 4]}`,
          'beta.kubernetes.io/instance-type': i === 0 ? 'm5.large' : 't3.medium',
          'node-role.kubernetes.io/worker': i === 0 ? null : ''
        }
      },
      status: {
        conditions: [
          {
            type: 'Ready',
            status: isReady ? 'True' : 'False'
          }
        ],
        capacity: {
          cpu: i === 0 ? '2' : '4',
          memory: i === 0 ? '8Gi' : '16Gi'
        },
        nodeInfo: {
          kubeletVersion: 'v1.28.4-eks-5e06acc',
          osImage: 'Amazon Linux 2',
          containerRuntimeVersion: 'containerd://1.7.13'
        }
      },
      spec: {
        providerID: `aws:///us-east-1/${['a', 'b', 'c', 'd'][i % 4]}/i-${Math.random().toString(36).substring(2, 15)}`
      }
    });
  }
  
  return { items: nodes };
}

// Generate simulated pod data for development purposes
function generateSimulatedPods(nodeData, namespace = null) {
  const pods = [];
  const defaultNamespaces = ['default', 'kube-system', 'monitoring', 'app'];
  const count = Math.min(Math.max(5, Math.floor(Math.random() * 20) + 5), 25);
  
  // List of common Pod statuses (mostly Running for realism)
  const statuses = ['Running', 'Running', 'Running', 'Running', 'Running', 'Running', 'Running', 'Running', 'Running', 'Pending', 'CrashLoopBackOff'];
  
  // Extract nodes from nodeData
  const nodes = nodeData?.items || [];
  if (nodes.length === 0) {
    // Create a default node if no nodes provided
    nodes.push({
      metadata: {
        name: 'ip-192-168-10-100.compute.internal'
      }
    });
  }
  
  for (let i = 0; i < count; i++) {
    // Assign pods to namespaces
    const podNamespace = namespace || defaultNamespaces[i % defaultNamespaces.length];
    let podName;
    
    // Generate more realistic pod names based on namespace
    if (podNamespace === 'kube-system') {
      const systemPods = ['kube-proxy', 'coredns', 'aws-node', 'kube-dns', 'cluster-autoscaler', 'metrics-server'];
      podName = `${systemPods[i % systemPods.length]}-${Math.random().toString(36).substring(2, 7)}`;
    } else if (podNamespace === 'monitoring') {
      const monitoringPods = ['prometheus', 'grafana', 'alertmanager', 'node-exporter'];
      podName = `${monitoringPods[i % monitoringPods.length]}-${Math.random().toString(36).substring(2, 7)}`;
    } else {
      podName = `${podNamespace}-app-${i}-${Math.random().toString(36).substring(2, 7)}`;
    }
    
    // Assign to a random node from the available nodes
    const nodeIndex = i % nodes.length;
    const nodeName = nodes[nodeIndex].metadata.name;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Generate creation time within the past 30 days
    const creationTime = new Date(Date.now() - (Math.floor(Math.random() * 30) + 1) * 24 * 60 * 60 * 1000);
    
    pods.push({
      metadata: {
        name: podName,
        namespace: podNamespace,
        uid: `pod-${i}-${Date.now()}`,
        creationTimestamp: creationTime.toISOString()
      },
      spec: {
        nodeName: nodeName
      },
      status: {
        phase: status,
        containerStatuses: [
          {
            name: 'main',
            ready: status === 'Running',
            restartCount: Math.floor(Math.random() * 5)
          }
        ]
      }
    });
  }
  
  return { items: pods };
}

// Check token endpoint - useful for debugging
app.post('/api/debug/token', (req, res) => {
  try {
    const { kubeconfig } = req.body;
    
    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }
    
    const token = extractK8sAuthToken(kubeconfig);
    const clusterEndpoint = getClusterEndpoint(kubeconfig);
    const caCert = extractCaCert(kubeconfig);
    
    // Create request URL
    const apiEndpoint = `${clusterEndpoint}/version`;
    
    // Make request to K8s API
    const request = https.request(apiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      // For development - ignore certificate errors
      rejectUnauthorized: false,
      ca: caCert
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          res.json(JSON.parse(data));
        } else {
          res.status(response.statusCode).json({
            error: `Kubernetes API error: ${response.statusCode}`,
            message: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Error contacting Kubernetes API:', error);
      res.status(500).json({ error: error.message });
    });
    
    request.end();
  } catch (error) {
    console.error('Error proxying to Kubernetes API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a token validation endpoint to help debug authentication issues
app.post('/api/debug/validate-token', async (req, res) => {
  try {
    const { kubeconfig } = req.body;
    
    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }
    
    // Extract token, cluster endpoint and CA cert
    let token;
    try {
      token = extractK8sAuthToken(kubeconfig);
      console.log('Token validation: Extracted token successfully');
      console.log('Token prefix:', token.substring(0, 20) + '...');
    } catch (tokenError) {
      return res.status(400).json({ 
        valid: false,
        error: `Failed to extract token: ${tokenError.message}`
      });
    }
    
    const clusterEndpoint = getClusterEndpoint(kubeconfig);
    const caCert = extractCaCert(kubeconfig);
    
    // Define the validation endpoint - we'll use /api/v1 which is always available
    const apiEndpoint = `${clusterEndpoint}/api/v1`;
    
    console.log(`Token validation: Making test request to ${apiEndpoint}`);
    
    // Make a request to the API server to validate the token
    const request = https.request(apiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      rejectUnauthorized: false,
      ca: caCert,
      timeout: 5000 // 5 second timeout for quick response
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Token validation response status: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          // Token is valid
          let responseData;
          try {
            responseData = JSON.parse(data);
          } catch (e) {
            responseData = { message: "Response was not valid JSON" };
          }
          
          res.json({
            valid: true,
            statusCode: response.statusCode,
            message: 'Token is valid and authenticated successfully',
            apiVersion: responseData.apiVersion,
            clusterEndpoint: clusterEndpoint
          });
        } else {
          // Token is invalid
          res.json({
            valid: false,
            statusCode: response.statusCode,
            message: `Authentication failed with status ${response.statusCode}`,
            responseData: data,
            clusterEndpoint: clusterEndpoint,
            token: token.substring(0, 20) + '...' // Only show the beginning of the token for debugging
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Token validation error:', error);
      res.status(500).json({
        valid: false,
        error: error.message,
        message: 'Error trying to validate token against the API server',
        clusterEndpoint: clusterEndpoint
      });
    });
    
    request.end();
  } catch (error) {
    console.error('Token validation endpoint error:', error);
    res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});

// Proxy Kubernetes API requests
app.post('/api/k8s/nodes', async (req, res) => {
  try {
    const { kubeconfig } = req.body;
    
    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }
    
    let token;
    try {
      // First check if this is an AWS EKS cluster and try to generate a fresh token
      const eksInfo = extractAwsEksInfo(kubeconfig);
      
      if (eksInfo && eksInfo.clusterName && eksInfo.region) {
        // Generate a fresh token via AWS CLI
        try {
          token = await generateAwsEksToken(eksInfo.clusterName, eksInfo.region);
          console.log('Successfully generated fresh AWS EKS token');
        } catch (eksError) {
          console.error('Failed to generate AWS EKS token, falling back to static token:', eksError.message);
          // Fall back to static token if AWS token generation fails
          token = extractK8sAuthToken(kubeconfig);
        }
      } else {
        // Not an AWS EKS cluster or can't extract EKS info, use normal token extraction
        token = extractK8sAuthToken(kubeconfig);
      }
      
      console.log('Token extracted successfully for nodes request');
      console.log('Token prefix:', token.substring(0, 20) + '...');
    } catch (tokenError) {
      console.error('Failed to extract token:', tokenError.message);
      return res.status(401).json({ error: `Authentication error: ${tokenError.message}` });
    }

    const clusterEndpoint = getClusterEndpoint(kubeconfig);
    const caCert = extractCaCert(kubeconfig);
    
    // Create request URL
    const apiEndpoint = `${clusterEndpoint}/api/v1/nodes`;
    
    console.log(`Making request to ${apiEndpoint}`);
    
    // Make request to K8s API
    const request = https.request(apiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      // For development - ignore certificate errors
      rejectUnauthorized: false,
      ca: caCert
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Nodes API response status: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          res.json(JSON.parse(data));
        } else {
          console.error(`Kubernetes API error: ${response.statusCode}`, data);
          res.status(response.statusCode).json({
            error: `Kubernetes API error: ${response.statusCode}`,
            message: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Error contacting Kubernetes API:', error);
      res.status(500).json({ error: error.message });
    });
    
    request.end();
  } catch (error) {
    console.error('Error proxying to Kubernetes API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy Kubernetes API requests for pods
app.post('/api/k8s/pods', async (req, res) => {
  try {
    const { kubeconfig, namespace } = req.body;
    
    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }
    
    let token;
    try {
      // First check if this is an AWS EKS cluster and try to generate a fresh token
      const eksInfo = extractAwsEksInfo(kubeconfig);
      
      if (eksInfo && eksInfo.clusterName && eksInfo.region) {
        // Generate a fresh token via AWS CLI
        try {
          token = await generateAwsEksToken(eksInfo.clusterName, eksInfo.region);
          console.log('Successfully generated fresh AWS EKS token for pods request');
        } catch (eksError) {
          console.error('Failed to generate AWS EKS token, falling back to static token:', eksError.message);
          // Fall back to static token if AWS token generation fails
          token = extractK8sAuthToken(kubeconfig);
        }
      } else {
        // Not an AWS EKS cluster or can't extract EKS info, use normal token extraction
        token = extractK8sAuthToken(kubeconfig);
      }
      console.log('Token extracted successfully for pods request');
      console.log('Token prefix:', token.substring(0, 20) + '...');
    } catch (tokenError) {
      console.error('Failed to extract token:', tokenError.message);
      return res.status(401).json({ error: `Authentication error: ${tokenError.message}` });
    }
    
    const clusterEndpoint = getClusterEndpoint(kubeconfig);
    const caCert = extractCaCert(kubeconfig);
    
    // Create request URL
    const apiEndpoint = namespace 
      ? `${clusterEndpoint}/api/v1/namespaces/${namespace}/pods` 
      : `${clusterEndpoint}/api/v1/pods`;
    
    console.log(`Making pods request to ${apiEndpoint}`);
    
    // Make request to K8s API
    const request = https.request(apiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      // For development - ignore certificate errors
      rejectUnauthorized: false,
      ca: caCert
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Pods API response status: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          res.json(JSON.parse(data));
        } else {
          console.error(`Kubernetes API error: ${response.statusCode}`, data);
          res.status(response.statusCode).json({
            error: `Kubernetes API error: ${response.statusCode}`,
            message: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Error contacting Kubernetes API:', error);
      res.status(500).json({ error: error.message });
    });
    
    request.end();
  } catch (error) {
    console.error('Error proxying to Kubernetes API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy Kubernetes API request for pod YAML
app.post('/api/k8s/pod-yaml', async (req, res) => {
  try {
    const { kubeconfig, podName, namespace } = req.body;
    
    if (!kubeconfig || !podName || !namespace) {
      return res.status(400).json({ error: 'Missing required parameters: kubeconfig, podName, namespace' });
    }
    
    let token;
    try {
      // First check if this is an AWS EKS cluster and try to generate a fresh token
      const eksInfo = extractAwsEksInfo(kubeconfig);
      
      if (eksInfo && eksInfo.clusterName && eksInfo.region) {
        // Generate a fresh token via AWS CLI
        try {
          token = await generateAwsEksToken(eksInfo.clusterName, eksInfo.region);
          console.log('Successfully generated fresh AWS EKS token for pod YAML request');
        } catch (eksError) {
          console.error('Failed to generate AWS EKS token, falling back to static token:', eksError.message);
          // Fall back to static token if AWS token generation fails
          token = extractK8sAuthToken(kubeconfig);
        }
      } else {
        // Not an AWS EKS cluster or can't extract EKS info, use normal token extraction
        token = extractK8sAuthToken(kubeconfig);
      }
      console.log('Token extracted successfully for pod YAML request');
      console.log('Token prefix:', token.substring(0, 20) + '...');
    } catch (tokenError) {
      console.error('Failed to extract token for pod YAML:', tokenError.message);
      return res.status(401).json({ error: `Authentication error: ${tokenError.message}` });
    }
    
    const clusterEndpoint = getClusterEndpoint(kubeconfig);
    const caCert = extractCaCert(kubeconfig);
    
    // First, get pod details
    const podApiEndpoint = `${clusterEndpoint}/api/v1/namespaces/${namespace}/pods/${podName}`;
    
    console.log(`Making pod YAML request to ${podApiEndpoint}`);
    
    // Make request to K8s API to get pod details
    const request = https.request(podApiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      // For development - ignore certificate errors
      rejectUnauthorized: false,
      ca: caCert
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Pod YAML API response status: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            const podData = JSON.parse(data);
            
            // Convert the data to YAML format
            const yaml = require('js-yaml').dump(podData);
            
            // Return the YAML response to the client
            res.json({ yaml });
          } catch (parseError) {
            console.error('Error parsing pod data:', parseError);
            res.status(500).json({
              error: 'Error parsing pod data',
              details: parseError.message
            });
          }
        } else {
          console.error(`Kubernetes API error: ${response.statusCode}`, data);
          res.status(response.statusCode).json({
            error: `Kubernetes API error: ${response.statusCode}`,
            message: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Error fetching pod YAML:', error);
      res.status(500).json({ error: error.message });
    });
    
    request.end();
  } catch (error) {
    console.error('Error proxying pod YAML request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to make Kubernetes API requests with token refresh retry for EKS
async function makeK8sRequestWithRetry(kubeconfig, apiPath, method = 'GET') {
  return new Promise(async (resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 2; // Initial attempt + 1 retry with fresh token

    const tryRequest = async (tokenToUse) => {
      attempts++;
      try {
        const clusterEndpoint = getClusterEndpoint(kubeconfig);
        const caCert = extractCaCert(kubeconfig);
        const apiUrl = `${clusterEndpoint}${apiPath}`; // Combine endpoint and path

        console.log(`Making K8s request (Attempt ${attempts}) to ${apiUrl} with token prefix: ${tokenToUse.substring(0, 20)}...`);

        const requestOptions = {
          method: method,
          headers: {
            'Authorization': `Bearer ${tokenToUse}`,
            'Accept': 'application/json'
          },
          ...(caCert && {
            ca: Buffer.from(caCert, 'base64').toString('ascii'),
            // Disable validation only for development, use rejectUnauthorized: true in production
            rejectUnauthorized: process.env.NODE_ENV !== 'production' ? false : true 
          })
        };

        // Add NODE_TLS_REJECT_UNAUTHORIZED warning suppression if needed
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          console.warn('IMPORTANT: TLS certificate validation is disabled. Use only for development.');
        } else {
          // Ensure it's set back to default if in production
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }

        const request = https.request(apiUrl, requestOptions, (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', async () => {
            try {
              if (response.statusCode === 200) {
                console.log(`K8s request to ${apiPath} successful (Status ${response.statusCode})`);
                resolve(JSON.parse(data));
              } else if (response.statusCode === 401 && attempts < maxAttempts) {
                console.warn(`K8s request failed with 401 (Attempt ${attempts}). Checking for EKS config to refresh token.`);
                const eksInfo = extractAwsEksInfo(kubeconfig);
                if (eksInfo && eksInfo.clusterName && eksInfo.region) {
                  console.log('EKS config found. Attempting to generate a fresh token.');
                  try {
                    const freshToken = await generateAwsEksToken(eksInfo.clusterName, eksInfo.region);
                    console.log('Successfully generated fresh AWS EKS token.');
                    // Update the environment variable potentially? Or just use for retry? Let's use just for retry.
                    // process.env.VITE_K8S_AUTH_TOKEN = freshToken; // Consider updating the env var?
                    await tryRequest(freshToken); // Retry with the fresh token
                  } catch (tokenError) {
                    console.error('Failed to generate fresh EKS token:', tokenError);
                    reject({ statusCode: 401, error: `Failed to refresh EKS token: ${tokenError.message}`, data: data });
                  }
                } else {
                  console.error('Request failed with 401, but no EKS info found to refresh token.');
                  reject({ statusCode: response.statusCode, error: `Request failed with status ${response.statusCode}`, data: data });
                }
              } else {
                console.error(`Error fetching ${apiPath}: Status code ${response.statusCode}`);
                reject({ statusCode: response.statusCode, error: `Request failed with status ${response.statusCode}`, data: data });
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

        request.end();

      } catch (initialError) {
        console.error(`Failed to initiate K8s request to ${apiPath}:`, initialError);
        // If token extraction itself failed before the request
         if (attempts === 1) { // Only reject on first attempt if token extraction fails
            reject({ statusCode: 500, error: `Failed to prepare request: ${initialError.message}` });
         } else {
           // If error happened during retry setup (less likely here)
           reject({ statusCode: 500, error: `Failed during retry setup: ${initialError.message}` });
         }
      }
    };

    // Start the first attempt
    try {
        const initialToken = extractK8sAuthToken(kubeconfig);
        await tryRequest(initialToken);
    } catch (tokenExtractionError) {
        console.error('Initial token extraction failed:', tokenExtractionError);
        reject({ statusCode: 500, error: `Failed to get initial token: ${tokenExtractionError.message}` });
    }
  });
}

// New endpoint to get namespaces
app.post('/api/k8s/namespaces', async (req, res) => {
  try {
    const { kubeconfig } = req.body;

    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }

    // For mock data mode
    if (process.env.VITE_USE_MOCK_K8S_DATA === 'true') {
      console.log('Using mock data for namespaces endpoint');
      return res.json({
        items: [
          { metadata: { name: 'default' } },
          { metadata: { name: 'kube-system' } },
          { metadata: { name: 'kube-public' } },
          { metadata: { name: 'kube-node-lease' } }
        ]
      });
    }

    // Use the new helper function
    const apiPath = '/api/v1/namespaces';
    const namespacesData = await makeK8sRequestWithRetry(kubeconfig, apiPath);
    res.json(namespacesData);

  } catch (error) {
    console.error('Error in namespaces endpoint:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: `Failed to fetch namespaces: ${error.error || error.message}` });
  }
});

// New endpoint to get services
app.post('/api/k8s/services', async (req, res) => {
  try {
    const { kubeconfig, namespace = '' } = req.body;

    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }

    // For mock data mode
    if (process.env.VITE_USE_MOCK_K8S_DATA === 'true') {
      console.log('Using mock data for services endpoint');
      return res.json({
        items: [
          {
            metadata: {
              name: 'kubernetes',
              namespace: 'default'
            },
            spec: {
              type: 'ClusterIP',
              ports: [{ port: 443, protocol: 'TCP' }]
            }
          }
        ]
      });
    }

    // Use the new helper function
    const apiPath = namespace
      ? `/api/v1/namespaces/${namespace}/services`
      : '/api/v1/services';
    const servicesData = await makeK8sRequestWithRetry(kubeconfig, apiPath);
    res.json(servicesData);

  } catch (error) {
    console.error('Error in services endpoint:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: `Failed to fetch services: ${error.error || error.message}` });
  }
});

// New endpoint to get kubeconfig details
app.post('/api/k8s/kubeconfig-details', async (req, res) => {
  try {
    const { kubeconfig } = req.body;
    
    if (!kubeconfig) {
      return res.status(400).json({ error: 'Missing kubeconfig' });
    }
    
    try {
      const config = yaml.load(kubeconfig);
      
      // Extract key information from kubeconfig
      const details = {
        clusters: config.clusters?.map(cluster => ({
          name: cluster.name,
          server: cluster.cluster?.server,
          certificateAuthorityPresent: !!cluster.cluster?.['certificate-authority-data'],
        })) || [],
        
        contexts: config.contexts?.map(context => ({
          name: context.name,
          cluster: context.context?.cluster,
          user: context.context?.user,
          namespace: context.context?.namespace,
        })) || [],
        
        users: config.users?.map(user => ({
          name: user.name,
          authType: user.user?.token ? 'token' : 
                   user.user?.['client-certificate-data'] ? 'certificate' : 
                   user.user?.exec ? 'exec' : 'unknown',
          execCommand: user.user?.exec?.command,
          execArgs: user.user?.exec?.args,
        })) || [],
        
        currentContext: config['current-context'],
        apiVersion: config.apiVersion,
        kind: config.kind
      };
      
      // For AWS EKS clusters, try to extract additional information
      const awsInfo = extractAwsEksInfo(kubeconfig);
      if (awsInfo) {
        details.awsInfo = awsInfo;
      }
      
      res.json(details);
    } catch (error) {
      console.error('Error parsing kubeconfig:', error);
      res.status(400).json({ error: `Failed to parse kubeconfig: ${error.message}` });
    }
    
  } catch (error) {
    console.error('Error in kubeconfig-details endpoint:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Configure Node.js to use the certificate authority data from the kubeconfig
// This is a global setting that affects all HTTPS requests
// For development only - in production, you would use proper certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Start server
app.listen(port, () => {
  console.log(`Kubernetes proxy server running on port ${port}`);
  console.log(`IMPORTANT: TLS certificate validation is disabled. Use only for development.`);
});