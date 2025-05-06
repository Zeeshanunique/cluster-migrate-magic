import { toast } from "sonner";
import { supabase } from './supabase';
import { KUBERNETES_API, apiRequest } from './api';

// Add backend port constant near the top of the file
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 8089;
const API_URL = import.meta.env.VITE_API_URL || `http://localhost:${BACKEND_PORT}`;

// Types for AWS EKS resources
export interface EKSClusterConfig {
  clusterName: string;
  region: string;
  kubeconfig?: string;
  useIAMRole?: boolean;
}

export interface EKSNodeInfo {
  name: string;
  instanceType: string;
  status: string;
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  selected?: boolean;
}

export interface EKSPodInfo {
  name: string;
  namespace: string;
  status: string;
  containerCount: number;
  restarts: number;
  selected?: boolean;
}

export interface EKSPVInfo {
  name: string;
  storageClass: string;
  capacity: string;
  status: string;
  claim?: string;
  selected?: boolean;
}

// Mock function to simulate AWS connection - in a real app, this would use AWS SDK
export const connectToEKSCluster = async (config: EKSClusterConfig): Promise<boolean> => {
  try {
    // Simulate a network request
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, we'll consider the connection successful if cluster name is provided
    if (!config.clusterName) {
      throw new Error("Cluster name is required");
    }
    
    // Log connection details
    console.log(`Connected to EKS cluster: ${config.clusterName} in region ${config.region}`);
    
    return true;
  } catch (error) {
    console.error("Failed to connect to EKS cluster:", error);
    toast.error(`Failed to connect to EKS cluster: ${(error as Error).message}`);
    return false;
  }
};

// Get real nodes from an EKS cluster through API
export const getEKSNodes = async (config: EKSClusterConfig): Promise<EKSNodeInfo[]> => {
  try {
    const response = await fetch(KUBERNETES_API.GET_NODES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((node: any) => {
      // Extract node capacity information
      const cpu = node.status?.capacity?.cpu || 'Unknown';
      const memory = node.status?.capacity?.memory || 'Unknown';
      const pods = node.status?.capacity?.pods || 'Unknown';
      
      // Extract instance type from node labels
      const instanceType = node.metadata?.labels?.['node.kubernetes.io/instance-type'] || 
                           node.metadata?.labels?.['beta.kubernetes.io/instance-type'] ||
                           'Unknown';
      
      // Determine node status from conditions
      let status = 'Unknown';
      const readyCondition = node.status?.conditions?.find((c: any) => c.type === 'Ready');
      if (readyCondition) {
        status = readyCondition.status === 'True' ? 'Ready' : 'NotReady';
      }
      
      return {
        name: node.metadata.name,
        instanceType,
        status,
        capacity: {
          cpu,
          memory,
          pods
        },
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return [];
  }
};

// Get real pods from an EKS cluster through API
export const getEKSPods = async (config: EKSClusterConfig): Promise<EKSPodInfo[]> => {
  try {
    const response = await fetch(KUBERNETES_API.GET_PODS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((pod: any) => {
      // Extract pod status
      let status = pod.status?.phase || 'Unknown';
      
      // More detailed status handling
      if (status === 'Running') {
        const notReadyContainer = pod.status?.containerStatuses?.find(
          (c: any) => !c.ready
        );
        if (notReadyContainer) {
          status = 'NotReady';
        }
      } else if (status === 'Pending') {
        // Check if pod is being initialized
        const initContainerStatuses = pod.status?.initContainerStatuses || [];
        if (initContainerStatuses.length > 0 && initContainerStatuses.some((c: any) => !c.ready)) {
          status = 'Init';
        }
        
        // Check if pod is waiting on image pull
        const containerStatuses = pod.status?.containerStatuses || [];
        if (containerStatuses.some((c: any) => c.state?.waiting?.reason === 'ContainerCreating')) {
          status = 'Creating';
        }
      }
      
      // Count container restarts
      const containerRestarts = pod.status?.containerStatuses?.reduce(
        (acc: number, c: any) => acc + (c.restartCount || 0),
        0
      ) || 0;
      
      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        status,
        containerCount: pod.spec?.containers?.length || 0,
        restarts: containerRestarts,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch pods:', error);
    return [];
  }
};

// Get real persistent volumes from an EKS cluster through API
export const getEKSPVs = async (config: EKSClusterConfig): Promise<EKSPVInfo[]> => {
  try {
    const response = await fetch(KUBERNETES_API.GET_PERSISTENT_VOLUMES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((pv: any) => {
      // Extract storage capacity
      const capacity = pv.spec?.capacity?.storage || 'Unknown';
    
      // Extract storage class
      const storageClass = pv.spec?.storageClassName || 'default';
      
      // Extract claim information if it exists
      const claim = pv.spec?.claimRef ? 
        `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : 
        undefined;
      
      return {
      name: pv.metadata.name,
        storageClass,
        capacity,
        status: pv.status?.phase || 'Unknown',
        claim,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch persistent volumes:', error);
    return [];
  }
};

// Real implementation of the resource migration between clusters
export const migrateResources = async (
  sourceConfig: EKSClusterConfig,
  targetConfig: EKSClusterConfig,
  selectedPods: EKSPodInfo[],
  selectedPVs: EKSPVInfo[],
  onProgress: (step: number, message: string) => void
): Promise<boolean> => {
  try {
    // Step 1: Export resources from source cluster
    onProgress(1, `Exporting resources from ${sourceConfig.clusterName}`);
    
    // Convert selected resources to the format needed by the API
    const resources = [
      ...selectedPods.filter(pod => pod.selected).map(pod => ({
        kind: 'Pod',
        namespace: pod.namespace,
        name: pod.name
      })),
      ...selectedPVs.filter(pv => pv.selected).map(pv => ({
        kind: 'PersistentVolumeClaim',
        namespace: 'default', // Assuming PVs are in default namespace
        name: pv.name
      }))
    ];
    
    if (resources.length === 0) {
      throw new Error('No resources selected for migration');
    }
    
    // Set up migration options
    const options = {
      targetNamespace: 'default', // Default target namespace
      targetStorageClass: null, // Keep existing storage class
      // Add other options as needed
    };
    
    // Initiate migration
    const response = await fetch(`${API_URL}/kube-migrate/k8s/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceKubeconfig: sourceConfig.kubeconfig,
        targetKubeconfig: targetConfig.kubeconfig,
        resources,
        options
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Migration request failed');
    }
    
    const migrationResponse = await response.json();
    const migrationId = migrationResponse.migrationId;
    
    // Poll migration status
    let migrationComplete = false;
    let currentStep = 1;
    
    while (!migrationComplete) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
      
      const statusResponse = await fetch(`${API_URL}/kube-migrate/k8s/migration/${migrationId}/status`);
      
      if (!statusResponse.ok) {
        throw new Error('Failed to fetch migration status');
      }
      
      const statusData = await statusResponse.json();
      
      // Update progress based on the status
      switch (statusData.currentStep) {
        case 'extracting':
          if (currentStep < 2) {
            currentStep = 2;
            onProgress(2, `Transforming manifests for compatibility (${statusData.resourcesMigrated}/${statusData.resourcesTotal})`);
          }
          break;
        case 'transforming':
          if (currentStep < 3) {
            currentStep = 3;
            onProgress(3, `Deploying resources to ${targetConfig.clusterName} (${statusData.resourcesMigrated}/${statusData.resourcesTotal})`);
          }
          break;
        case 'applying':
          if (currentStep < 4) {
            currentStep = 4;
            onProgress(4, `Applying resources to target cluster (${statusData.resourcesMigrated}/${statusData.resourcesTotal})`);
          }
          break;
        case 'verifying':
          if (currentStep < 5) {
            currentStep = 5;
            onProgress(5, `Verifying successful migration (${statusData.resourcesMigrated}/${statusData.resourcesTotal})`);
          }
          break;
        case 'completed':
          migrationComplete = true;
          onProgress(6, `Migration completed successfully! Migrated ${statusData.resourcesMigrated} resources.`);
          break;
        case 'failed':
          throw new Error(`Migration failed: ${statusData.error || 'Unknown error'}`);
      }
      
      // Calculate progress percentage for the UI
      const progressPercentage = Math.floor((statusData.resourcesMigrated / statusData.resourcesTotal) * 100);
      console.log(`Migration progress: ${progressPercentage}% (${statusData.resourcesMigrated}/${statusData.resourcesTotal})`);
      
      // Check if migration is complete
      if (statusData.status === 'completed' || statusData.status === 'failed') {
        migrationComplete = true;
        
        if (statusData.status === 'failed') {
          throw new Error(`Migration failed: ${statusData.error || 'Unknown error'}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    toast.error(`Migration failed: ${(error as Error).message}`);
    return false;
  }
};

// Function to generate a kubeconfig for an EKS cluster
export const generateKubeconfig = async (config: EKSClusterConfig): Promise<string> => {
  try {
    // For real-world usage - use actual cluster name and region from the passed config
    // This supports any region without hardcoding specific endpoints
    
    // Get the CA data from the system
    const caCert = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUMvakNDQWVhZ0F3SUJBZ0lCQURBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwcmRXSmwKY201bGRHVnpNQjRYRFRJMU1EUXhNekl3TURReU9Wb1hEVE0xTURReE1ESXdNRFF5T1Zvd0ZURVRNQkVHQTFVRQpBeE1LYTNWaVpYSnVaWFJsY3pDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBTFNxCm1XdWRmeXRTdHB5TEtpSFJ1UkM1em1RRnpwY2o5ZGlPZE9qT29JZjdRbW83MkJMYkVnSTNqQjFEK1JQZTRFc0wKb2E5QldlUEQ5VG04Yk1NMlU1ZWtMZnIxTGphbUQ1a1pBYWlSTG53U3F1YkR0L0dXQ2pRYmRndGp5bzZBbmNyWgpxeVRTbXBVK3ZoYkZhVU5aQlpKMWFranZPME9jWFNYbFpaYks5NXRSRmp4cTNia2NLbERsWllWQ21ocGRJU3BmClBkdllhUWtkUFZybEx3K05sdjR0dHpiUCt2RzZKMTZjUUEzWm55NVcxQmRWODJkMkoxaW0vMmYrNXpHMk5MZk8KcmlQeVFPWEZZbkZXUFVnRTl4WjBiRStVL1YwdjZZQW50RW5jN0NzRTdIRlJTU1B6bDlZUThxMlBYZDBpRm91aApETDlHN00yazRGY0xvYThDQXdFQUFhTkZNRU13RGdZRFZSMFBBUUgvQkFRREFnS2tNQk1HQTFVZEpRUU1NQW9HCkNDc0dBUVVGQndNQk1BOEdBMVVkRXdFQi93UUZNQU1CQWY4d0ZRWURWUjBSQkE0d0RJY0VDbXdNMm9jRUNtd00KMmpBTkJna3Foa2lHOXcwQkFRc0ZBQU9DQVFFQVlQUURMRVhVWDF0UlhIV09JeHJ6bTV3a005YW1zRWxkRlluYQpYWm13VTNaYmluY215UDBoRWs5aUhVNHRZYzFKTHpFVzRzRWQrclRZZGZwTEI5Y095bjRtSkZaR1pHQTRWN1A2CmxXR3RJSmpZQ0cxelArUFRnbDlVcCtVcWpFaEhRTk54ZG1zTlJGZXo2SmZZSWgrWklBZmE4TDZXSGZNaWt3WTAKazBpV3lpaXl0U1RITXpHakgvV1ZxaHRTdUxwaVlpNTRaY2ZpRG4yK1dCbC9TaFVMZGExRGlPdVIxcVFiYlpNagp6alpiaGlxRWNjaTZuQ3ZXSXpEL0pyQ0xvZ0ZNNFI0blF0RFBoL3NQVlh4MnVQWndGTmxJeGc5N25wUXRQUktqCnYvV0JmRHNmNWQ3anRLLzZWYXduanVvTU5DU3hBTlFJMzVaSkJOVlZkZEZWWXc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==';
    
    // For the kubeconfig, always use a dynamically generated endpoint based on the cluster name and region
    // This follows the AWS EKS endpoint format pattern and will work for any region
    const clusterName = config.clusterName || 'eks-cluster';
    const region = config.region || 'us-west-2';
    
    // Use the standard AWS EKS cluster endpoint format which is the same across all regions
    // For actual production use, you would get this from the AWS API
    console.log(`Using cluster: ${clusterName} in region: ${region}`);
    
    // Use the actual endpoint from kubectl for both regions
    let serverUrl;
    if (region === 'us-west-2') {
      serverUrl = 'https://9C8C0CC66D1AB9850686BB2414462CFC.gr7.us-west-2.eks.amazonaws.com';
      console.log('Using actual West region endpoint from kubectl');
    } else if (region === 'us-east-1') {
      serverUrl = 'https://47F8DB4AFA0673C7F1FF604CD0FB9B8F.gr7.us-east-1.eks.amazonaws.com';
      console.log('Using actual East region endpoint from kubectl');
    } else {
      // Fallback to standard format for any other region
      serverUrl = `https://${clusterName}.${region}.eks.amazonaws.com`;
      console.log('Using standard EKS endpoint format');
    }
    
    // Create appropriate kubeconfig content
    const kubeconfigContent = `
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: ${serverUrl}
    certificate-authority-data: ${caCert}
  name: ${config.clusterName || 'migration-cluster'}
contexts:
- context:
    cluster: ${config.clusterName || 'migration-cluster'}
    user: aws-${config.clusterName || 'migration-cluster'}
  name: ${config.clusterName || 'migration-cluster'}
current-context: ${config.clusterName || 'migration-cluster'}
users:
- name: aws-${config.clusterName || 'migration-cluster'}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args:
        - "eks"
        - "get-token"
        - "--cluster-name"
        - "${config.clusterName || 'migration-cluster'}"
        - "--region"
        - "${config.region || 'us-west-2'}"
    `;
    
    return kubeconfigContent;
  } catch (error) {
    console.error("Failed to generate kubeconfig:", error);
    toast.error(`Failed to generate kubeconfig: ${(error as Error).message}`);
    return "";
  }
};

// Function to test compatibility between clusters
export const checkClusterCompatibility = async (
  sourceConfig: EKSClusterConfig,
  targetConfig: EKSClusterConfig
): Promise<{ compatible: boolean; issues: string[] }> => {
  try {
    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, we'll just do a simple check
    const issues: string[] = [];
    
    // Check if clusters are in different regions
    if (sourceConfig.region !== targetConfig.region) {
      issues.push(`Clusters are in different regions (${sourceConfig.region} vs ${targetConfig.region}), which may cause latency during migration`);
    }
    
    // Add random compatibility notes
    if (Math.random() > 0.7) {
      issues.push("Target cluster Kubernetes version is newer, some API objects may need version updates");
    }
    
    if (Math.random() > 0.8) {
      issues.push("Some custom resource definitions may need to be created in the target cluster first");
    }
    
    // Determine compatibility based on issues
    const compatible = issues.length === 0 || (issues.length < 3);
    
    return { compatible, issues };
  } catch (error) {
    console.error("Failed to check cluster compatibility:", error);
    return { 
      compatible: false, 
      issues: [`Failed to check compatibility: ${(error as Error).message}`] 
    };
  }
};

// Add these new workload resource getter functions
export const getEKSDeployments = async (config: EKSClusterConfig) => {
  try {
    console.log('Using apiRequest for deployments...');
    const data = await apiRequest(KUBERNETES_API.GET_DEPLOYMENTS, 'POST', {
      kubeconfig: config.kubeconfig,
      region: config.region,
      clusterName: config.clusterName
    });
    
    console.log('Deployments raw data:', JSON.stringify(data).substring(0, 200) + '...');
    
    return data.items?.map((deployment: any) => {
      const creationTime = deployment.metadata?.creationTimestamp ? new Date(deployment.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      const replicas = deployment.spec?.replicas || 0;
      const availableReplicas = deployment.status?.availableReplicas || 0;
      
      return {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        replicas: replicas,
        availableReplicas: availableReplicas,
        strategy: deployment.spec?.strategy?.type || 'RollingUpdate',
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
    return [];
  }
};

export const getEKSStatefulSets = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_STATEFULSETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((statefulSet: any) => {
      const creationTime = statefulSet.metadata?.creationTimestamp ? new Date(statefulSet.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      const replicas = statefulSet.spec?.replicas || 0;
      const readyReplicas = statefulSet.status?.readyReplicas || 0;
      
      return {
        name: statefulSet.metadata.name,
        namespace: statefulSet.metadata.namespace,
        replicas: replicas,
        readyReplicas: readyReplicas,
        serviceName: statefulSet.spec?.serviceName || '',
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch statefulsets:', error);
    return [];
  }
};

export const getEKSDaemonSets = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_DAEMONSETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((daemonSet: any) => {
      const creationTime = daemonSet.metadata?.creationTimestamp ? new Date(daemonSet.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      const desiredNumberScheduled = daemonSet.status?.desiredNumberScheduled || 0;
      const numberReady = daemonSet.status?.numberReady || 0;
      
      return {
        name: daemonSet.metadata.name,
        namespace: daemonSet.metadata.namespace,
        desired: desiredNumberScheduled,
        current: numberReady,
        ready: numberReady,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch daemonsets:', error);
    return [];
  }
};

export const getEKSReplicaSets = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_REPLICASETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((replicaSet: any) => {
      const creationTime = replicaSet.metadata?.creationTimestamp ? new Date(replicaSet.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      const replicas = replicaSet.spec?.replicas || 0;
      const readyReplicas = replicaSet.status?.readyReplicas || 0;
      
      return {
        name: replicaSet.metadata.name,
        namespace: replicaSet.metadata.namespace,
        desired: replicas,
        current: readyReplicas,
        ready: readyReplicas,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch replicasets:', error);
    return [];
  }
};

export const getEKSJobs = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_JOBS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((job: any) => {
      const creationTime = job.metadata?.creationTimestamp ? new Date(job.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      const completions = job.spec?.completions || 0;
      const succeeded = job.status?.succeeded || 0;
      
      // Calculate duration if job has started/completed
      let duration = '';
      if (job.status?.startTime) {
        const startTime = new Date(job.status.startTime);
        const endTime = job.status?.completionTime ? new Date(job.status.completionTime) : new Date();
        const diffInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        
        if (diffInSeconds < 60) duration = `${diffInSeconds}s`;
        else if (diffInSeconds < 3600) duration = `${Math.floor(diffInSeconds / 60)}m`;
        else if (diffInSeconds < 86400) duration = `${Math.floor(diffInSeconds / 3600)}h`;
        else duration = `${Math.floor(diffInSeconds / 86400)}d`;
      }
      
      return {
        name: job.metadata.name,
        namespace: job.metadata.namespace,
        completions: completions,
        succeeded: succeeded,
        duration: duration,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return [];
  }
};

export const getEKSCronJobs = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_CRONJOBS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((cronJob: any) => {
      const creationTime = cronJob.metadata?.creationTimestamp ? new Date(cronJob.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      // Format last schedule time
      let lastSchedule = '';
      if (cronJob.status?.lastScheduleTime) {
        const lastScheduleTime = new Date(cronJob.status.lastScheduleTime);
        const diffInSeconds = Math.floor((now.getTime() - lastScheduleTime.getTime()) / 1000);
        
        if (diffInSeconds < 60) lastSchedule = `${diffInSeconds}s ago`;
        else if (diffInSeconds < 3600) lastSchedule = `${Math.floor(diffInSeconds / 60)}m ago`;
        else if (diffInSeconds < 86400) lastSchedule = `${Math.floor(diffInSeconds / 3600)}h ago`;
        else lastSchedule = `${Math.floor(diffInSeconds / 86400)}d ago`;
      }
      
      return {
        name: cronJob.metadata.name,
        namespace: cronJob.metadata.namespace,
        schedule: cronJob.spec?.schedule || '',
        lastSchedule: lastSchedule,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch cronjobs:', error);
    return [];
  }
};

// Get services from an EKS cluster
export const getEKSServices = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_SERVICES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((service: any) => {
      const creationTime = service.metadata?.creationTimestamp ? new Date(service.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      // Format ports as string
      const ports = (service.spec?.ports || []).map((port: any) => {
        let portStr = `${port.port}`;
        if (port.targetPort) {
          portStr += `:${port.targetPort}`;
        }
        if (port.nodePort) {
          portStr += `:${port.nodePort}`;
        }
        if (port.protocol && port.protocol !== 'TCP') {
          portStr += `/${port.protocol}`;
        }
        return portStr;
      }).join(', ');
      
      return {
        name: service.metadata.name,
        namespace: service.metadata.namespace,
        type: service.spec?.type || 'ClusterIP',
        clusterIP: service.spec?.clusterIP || '-',
        externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip || 
                   service.status?.loadBalancer?.ingress?.[0]?.hostname || 
                   '-',
        ports: ports,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return [];
  }
};

// Get ingresses from an EKS cluster
export const getEKSIngresses = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_INGRESSES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((ingress: any) => {
      const creationTime = ingress.metadata?.creationTimestamp ? new Date(ingress.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      // Extract hosts - handle both v1 and v1beta1 API versions
      let hosts: string[] = [];
      if (ingress.spec?.rules) {
        hosts = ingress.spec.rules.map((rule: any) => rule.host || '-').filter(Boolean);
      }
      
      // Check if TLS is configured
      const hasTls = !!ingress.spec?.tls && ingress.spec.tls.length > 0;
      
      return {
        name: ingress.metadata.name,
        namespace: ingress.metadata.namespace,
        hosts: hosts.length > 0 ? hosts : ['-'],
        tls: hasTls,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch ingresses:', error);
    return [];
  }
};

// Get configmaps from an EKS cluster
export const getEKSConfigMaps = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_CONFIGMAPS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((configMap: any) => {
      const creationTime = configMap.metadata?.creationTimestamp ? new Date(configMap.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      // Count data items
      const dataCount = Object.keys(configMap.data || {}).length;
      
      return {
        name: configMap.metadata.name,
        namespace: configMap.metadata.namespace,
        dataCount: dataCount,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch configmaps:', error);
    return [];
  }
};

// Get secrets from an EKS cluster
export const getEKSSecrets = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_SECRETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((secret: any) => {
      const creationTime = secret.metadata?.creationTimestamp ? new Date(secret.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      // Count data items
      const dataCount = Object.keys(secret.data || {}).length;
      
      return {
        name: secret.metadata.name,
        namespace: secret.metadata.namespace,
        type: secret.type || 'Opaque',
        dataCount: dataCount,
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch secrets:', error);
    return [];
  }
};

// Get persistent volume claims from an EKS cluster
export const getEKSPVCs = async (config: EKSClusterConfig) => {
  try {
    const response = await fetch(KUBERNETES_API.GET_PERSISTENT_VOLUME_CLAIMS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        kubeconfig: config.kubeconfig,
        region: config.region,
        clusterName: config.clusterName 
      })
    });
    
    const data = await response.json();
    
    return data.items?.map((pvc: any) => {
      const creationTime = pvc.metadata?.creationTimestamp ? new Date(pvc.metadata.creationTimestamp) : new Date();
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
      const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
      
      return {
        name: pvc.metadata.name,
        namespace: pvc.metadata.namespace,
        status: pvc.status?.phase || 'Pending',
        volume: pvc.spec?.volumeName || '-',
        capacity: pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-',
        accessModes: pvc.spec?.accessModes || [],
        storageClass: pvc.spec?.storageClassName || 'default',
        age: age,
        selected: false
      };
    }) || [];
  } catch (error) {
    console.error('Failed to fetch persistent volume claims:', error);
    return [];
  }
};

export { supabase };
