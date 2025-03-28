import { toast } from 'sonner';

// Mocked interfaces for Kubernetes resources
interface KubernetesNode {
  name: string;
  status: string;
  roles: string[];
  version: string;
  ready: boolean;
  cpu: {
    capacity: string;
    usage: string;
    percent: number;
  };
  memory: {
    capacity: string;
    usage: string;
    percent: number;
  };
  creationTimestamp: string;
}

interface KubernetesPod {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  node: string;
  age: string;
  creationTimestamp: string;
}

interface KubernetesClusterStatus {
  nodes: KubernetesNode[];
  pods: KubernetesPod[];
  kubernetesVersion: string;
  timestamp: string;
}

// This function simulates getting cluster status data
export async function getClusterStatus(kubeconfig: string): Promise<KubernetesClusterStatus> {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Extract cluster name from the config for more realistic mock data
    const clusterNameMatch = kubeconfig.match(/--cluster-name\s+[\r\n]+\s+-\s+([\w-]+)/) || 
                             kubeconfig.match(/current-context:\s+"?([\w.-]+)"?/);
                             
    const clusterName = clusterNameMatch?.[1] || 'eks-cluster';
    
    // Mock nodes data
    const nodes: KubernetesNode[] = [
      {
        name: `${clusterName}-node-1`,
        status: 'Ready',
        roles: ['control-plane', 'master'],
        version: 'v1.26.4-eks-a59e1f0',
        ready: true,
        cpu: {
          capacity: '4',
          usage: '1250m',
          percent: 31
        },
        memory: {
          capacity: '16Gi',
          usage: '6.2Gi',
          percent: 39
        },
        creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: `${clusterName}-node-2`,
        status: 'Ready',
        roles: ['worker'],
        version: 'v1.26.4-eks-a59e1f0',
        ready: true,
        cpu: {
          capacity: '8',
          usage: '3200m',
          percent: 40
        },
        memory: {
          capacity: '32Gi',
          usage: '18.5Gi',
          percent: 58
        },
        creationTimestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: `${clusterName}-node-3`,
        status: Math.random() > 0.8 ? 'NotReady' : 'Ready',
        roles: ['worker'],
        version: 'v1.26.4-eks-a59e1f0',
        ready: Math.random() > 0.8 ? false : true,
        cpu: {
          capacity: '8',
          usage: '5800m',
          percent: 73
        },
        memory: {
          capacity: '32Gi',
          usage: '24.8Gi',
          percent: 78
        },
        creationTimestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Mock pods data
    const pods: KubernetesPod[] = [
      {
        name: 'kube-apiserver-master',
        namespace: 'kube-system',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-1`,
        age: '30d',
        creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'aws-node-xhd4f',
        namespace: 'kube-system',
        status: 'Running',
        restarts: 2,
        node: `${clusterName}-node-2`,
        age: '25d',
        creationTimestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'coredns-7975d6fb9-9qzn5',
        namespace: 'kube-system',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-2`,
        age: '25d',
        creationTimestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'kube-proxy-8tbfj',
        namespace: 'kube-system',
        status: nodes[2].status === 'Ready' ? 'Running' : 'CrashLoopBackOff',
        restarts: nodes[2].status === 'Ready' ? 0 : 3,
        node: `${clusterName}-node-3`,
        age: '20d',
        creationTimestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'metrics-server-58b4f7d6f-6n5w8',
        namespace: 'kube-system',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-1`,
        age: '15d',
        creationTimestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'cluster-autoscaler-77f89dc789-ltdzw',
        namespace: 'kube-system',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-1`,
        age: '15d',
        creationTimestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'frontend-deployment-7d8f6d8c69-b9xks',
        namespace: 'default',
        status: 'Running',
        restarts: 1,
        node: `${clusterName}-node-2`,
        age: '10d',
        creationTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'frontend-deployment-7d8f6d8c69-htjpm',
        namespace: 'default',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-3`,
        age: '10d',
        creationTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'backend-api-6c67bc9887-fvt7m',
        namespace: 'default',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-2`,
        age: '10d',
        creationTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'db-statefulset-0',
        namespace: 'default',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-3`,
        age: '10d',
        creationTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'ingress-nginx-controller-f95dd8795-ksgxv',
        namespace: 'ingress-nginx',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-1`,
        age: '5d',
        creationTimestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: 'cert-manager-68974fb5c4-pd9h5',
        namespace: 'cert-manager',
        status: 'Running',
        restarts: 0,
        node: `${clusterName}-node-2`,
        age: '5d',
        creationTimestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return {
      nodes,
      pods,
      kubernetesVersion: 'v1.26.4-eks',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting cluster status:', error);
    toast.error('Failed to connect to Kubernetes cluster');
    throw new Error('Failed to connect to Kubernetes cluster: ' + String(error));
  }
}

// Parse kubeconfig to extract contexts
export function parseKubeContexts(kubeconfig: string): { name: string, cluster: string, user: string, namespace?: string }[] {
  try {
    const contexts: { name: string, cluster: string, user: string, namespace?: string }[] = [];
    
    // Match the contexts section and extract each context
    const contextsSection = kubeconfig.match(/contexts:[\s\S]*?(?=\nusers:|$)/);
    if (!contextsSection) return contexts;
    
    // Extract each context block
    const contextBlocks = contextsSection[0].matchAll(/- context:[\s\S]*?(?=- context:|$)/g);
    
    for (const block of Array.from(contextBlocks)) {
      const nameMatch = block[0].match(/name:\s+"?([^"\n]+)"?/);
      const clusterMatch = block[0].match(/cluster:\s+"?([^"\n]+)"?/);
      const userMatch = block[0].match(/user:\s+"?([^"\n]+)"?/);
      const namespaceMatch = block[0].match(/namespace:\s+"?([^"\n]+)"?/);
      
      if (nameMatch && clusterMatch && userMatch) {
        contexts.push({
          name: nameMatch[1],
          cluster: clusterMatch[1],
          user: userMatch[1],
          namespace: namespaceMatch ? namespaceMatch[1] : undefined
        });
      }
    }
    
    return contexts;
  } catch (error) {
    console.error('Error parsing kube contexts:', error);
    return [];
  }
}

// Parse all clusters from kubeconfig
export function parseKubeClusters(kubeconfig: string): { name: string, server: string, isEks: boolean }[] {
  try {
    const clusters: { name: string, server: string, isEks: boolean }[] = [];
    
    // Match the clusters section and extract each cluster
    const clustersSection = kubeconfig.match(/clusters:[\s\S]*?(?=\ncontexts:|$)/);
    if (!clustersSection) return clusters;
    
    // Extract each cluster block
    const clusterBlocks = clustersSection[0].matchAll(/- cluster:[\s\S]*?(?=- cluster:|$)/g);
    
    for (const block of Array.from(clusterBlocks)) {
      const nameMatch = block[0].match(/name:\s+"?([^"\n]+)"?/);
      const serverMatch = block[0].match(/server:\s+"?([^"\n]+)"?/);
      
      if (nameMatch && serverMatch) {
        const isEks = serverMatch[1].includes('eks.amazonaws.com');
        clusters.push({
          name: nameMatch[1],
          server: serverMatch[1],
          isEks
        });
      }
    }
    
    return clusters;
  } catch (error) {
    console.error('Error parsing kube clusters:', error);
    return [];
  }
}

// Extract EKS cluster name from kubeconfig
export function extractEksClusterName(kubeconfig: string): string | null {
  try {
    // Try to find the cluster name in various places
    
    // 1. Look in the exec args section
    const eksClusterMatch = kubeconfig.match(/--cluster-name\s+[\r\n]+\s+-\s+([\w-]+)/);
    if (eksClusterMatch && eksClusterMatch[1]) {
      return eksClusterMatch[1];
    }
    
    // 2. Try to get from current-context if it looks like an EKS ARN
    const currentContextMatch = kubeconfig.match(/current-context:\s+"?(arn:aws:eks:[^:]+:[^:]+:cluster\/([^"\s]+))"?/);
    if (currentContextMatch && currentContextMatch[2]) {
      return currentContextMatch[2];
    }

    // 3. Look for clusters section with an ARN name
    const clusterArnMatch = kubeconfig.match(/clusters:[\s\S]*?- name:\s+"?(arn:aws:eks:[^:]+:[^:]+:cluster\/([^"\s]+))"?/);
    if (clusterArnMatch && clusterArnMatch[2]) {
      return clusterArnMatch[2];
    }
    
    // 4. Look for clusters section with a name that contains eks
    const clusterNameMatch = kubeconfig.match(/clusters:[\s\S]*?- name:.*?([\w-]+\.eks\.[^."\s]+)[\s\S]*?certificate-authority-data/);
    if (clusterNameMatch && clusterNameMatch[1]) {
      return clusterNameMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting EKS cluster name:', error);
    return null;
  }
}

// Extract AWS region from kubeconfig
export function extractAwsRegion(kubeconfig: string): string | null {
  try {
    // Look for region in args section
    const regionMatch = kubeconfig.match(/--region\s+[\r\n]+\s+-\s+([\w-]+)/);
    if (regionMatch && regionMatch[1]) {
      return regionMatch[1];
    }
    
    // Try to extract from server URL
    const serverMatch = kubeconfig.match(/server:\s+https:\/\/[\w.-]+\.([\w-]+)\.eks\.amazonaws\.com/);
    if (serverMatch && serverMatch[1]) {
      return serverMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting AWS region:', error);
    return null;
  }
}

// Extract account ID from kubeconfig ARN
export function extractAwsAccountId(kubeconfig: string): string | null {
  try {
    const arnMatch = kubeconfig.match(/arn:aws:eks:[^:]+:(\d+):cluster/);
    if (arnMatch && arnMatch[1]) {
      return arnMatch[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting AWS account ID:', error);
    return null;
  }
}

// Parse kubeconfig to extract useful information
export function parseKubeconfig(kubeconfig: string) {
  try {
    // Using regex instead of yaml parsing for browser compatibility
    const clusters = parseKubeClusters(kubeconfig);
    
    // Extract users information
    const users: { name: string, authType: string }[] = [];
    const usersSection = kubeconfig.match(/users:[\s\S]*?(?=$)/);
    
    if (usersSection) {
      const userBlocks = usersSection[0].matchAll(/- name:\s+"?([^"\n]+)"?[\s\S]*?(?=- name:|$)/g);
      
      for (const block of Array.from(userBlocks)) {
        const nameMatch = block[0].match(/- name:\s+"?([^"\n]+)"?/);
        if (nameMatch) {
          let authType = 'unknown';
          if (block[0].includes('exec:')) authType = 'exec';
          else if (block[0].includes('token:')) authType = 'token';
          else if (block[0].includes('client-certificate-data:')) authType = 'certificate';
          
          users.push({
            name: nameMatch[1],
            authType
          });
        }
      }
    }
    
    // Extract current context
    const currentContextMatch = kubeconfig.match(/current-context:\s+"?([^"\n]+)"?/);
    const currentContext = currentContextMatch ? currentContextMatch[1] : '';
    
    // Extract contexts
    const contexts = parseKubeContexts(kubeconfig).map(ctx => ({
      ...ctx,
      isCurrent: ctx.name === currentContext
    }));
    
    return {
      clusters,
      users, 
      contexts,
      currentContext
    };
  } catch (error) {
    console.error('Error parsing kubeconfig:', error);
    return null;
  }
}

// Get kubeconfig details in a structured format for display
export function getKubeconfigDetails(kubeconfig: string) {
  const parsedConfig = parseKubeconfig(kubeconfig);
  if (!parsedConfig) return null;
  
  const currentContext = parsedConfig.contexts.find(ctx => ctx.isCurrent);
  
  if (!currentContext) return null;
  
  const currentCluster = parsedConfig.clusters.find(
    cluster => cluster.name === currentContext.cluster
  );
  
  const currentUser = parsedConfig.users.find(
    user => user.name === currentContext.user
  );
  
  return {
    clusterName: currentContext.cluster,
    server: currentCluster?.server || 'Unknown',
    currentContext: currentContext.name,
    namespace: currentContext.namespace || 'default',
    user: currentUser?.name || 'Unknown',
    authType: currentUser?.authType || 'Unknown'
  };
}

// Download a kubeconfig file
export function downloadKubeconfig(kubeconfig: string, clusterName: string) {
  const blob = new Blob([kubeconfig], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kubeconfig-${clusterName || 'cluster'}.yaml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Simulate the fetchClusterStatus function for backward compatibility
export async function fetchClusterStatus(kubeconfig: string) {
  return getClusterStatus(kubeconfig);
}

export default {
  fetchClusterStatus,
  extractEksClusterName,
  extractAwsRegion,
  extractAwsAccountId,
  parseKubeContexts,
  parseKubeClusters,
  getClusterStatus,
  getKubeconfigDetails,
  downloadKubeconfig
}; 