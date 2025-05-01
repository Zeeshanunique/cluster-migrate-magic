import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, 
  ChevronRight, 
  AlertCircle, 
  Loader2,
  Cloud,
  Database,
  Server,
  Shield,
  ChevronsUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import BlurContainer from '@/components/ui/BlurContainer';
import { toast } from 'sonner';
import AWSClusterConfig from './AWSClusterConfig';
import ResourceInventory from './ResourceInventory';
import CompatibilityCheck from './CompatibilityCheck';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/dynamodb';
import {
  EKSClusterConfig,
  EKSNodeInfo,
  EKSPodInfo, 
  EKSPVInfo, 
  connectToEKSCluster,
  getEKSNodes,
  getEKSPods,
  getEKSPVs,
  generateKubeconfig,
  checkClusterCompatibility,
  getEKSDeployments,
  getEKSStatefulSets,
  getEKSDaemonSets,
  getEKSReplicaSets,
  getEKSJobs,
  getEKSCronJobs,
  getEKSServices,
  getEKSIngresses,
  getEKSConfigMaps,
  getEKSSecrets,
  getEKSPVCs
} from '@/utils/aws';
import MigrationService from '@/utils/migrationService';
import { KUBERNETES_API } from '@/utils/api';

const steps = [
  { 
    id: 'connect', 
    title: 'Connect to AWS EKS Clusters', 
    description: 'Connect to source and target EKS clusters',
    icon: <Cloud className="h-4 w-4" />
  },
  { 
    id: 'inventory', 
    title: 'Resource Inventory', 
    description: 'View and select resources to migrate',
    icon: <Database className="h-4 w-4" />
  },
  { 
    id: 'compatibility', 
    title: 'Compatibility Check', 
    description: 'Verify clusters are compatible for migration',
    icon: <Server className="h-4 w-4" />
  },
  { 
    id: 'migration', 
    title: 'Migration Execution', 
    description: 'Migrate selected resources to target cluster',
    icon: <Shield className="h-4 w-4" />
  },
  { 
    id: 'verify', 
    title: 'Verify Migration', 
    description: 'Verify all resources are properly migrated',
    icon: <Check className="h-4 w-4" />
  },
];

const MigrationWizard = () => {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('cluster') || '';
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Available clusters
  const [availableSingleClusters, setAvailableSingleClusters] = useState<Cluster[]>([]);
  const [availableMultiClusters, setAvailableMultiClusters] = useState<Cluster[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(false);
  
  // Source cluster data
  const [sourceCluster, setSourceCluster] = useState<Cluster | null>(null);
  const [targetCluster, setTargetCluster] = useState<Cluster | null>(null);
  
  // AWS EKS specific configuration
  const [sourceConfig, setSourceConfig] = useState<EKSClusterConfig>({
    clusterName: clusterId || '',
    region: 'us-east-1',
    useIAMRole: false,
  });

  const [targetConfig, setTargetConfig] = useState<EKSClusterConfig>({
    clusterName: '',
    region: 'us-east-1',
    useIAMRole: false,
  });

  // Resource data states
  const [sourceConnected, setSourceConnected] = useState(false);
  const [targetConnected, setTargetConnected] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  // Use correct Namespace interface matching ResourceInventory component
  const [namespaces, setNamespaces] = useState<{name: string, status: string, age: string, labels: Record<string, string>, selected: boolean}[]>([]);
  const [nodes, setNodes] = useState<EKSNodeInfo[]>([]);
  const [pods, setPods] = useState<EKSPodInfo[]>([]);
  const [persistentVolumes, setPersistentVolumes] = useState<EKSPVInfo[]>([]);
  
  // Add workload resources
  const [deployments, setDeployments] = useState<{
    name: string;
    namespace: string;
    replicas: number;
    availableReplicas: number;
    strategy: string;
    age: string;
    selected: boolean;
  }[]>([]);

  const [statefulSets, setStatefulSets] = useState<{
    name: string;
    namespace: string;
    replicas: number;
    readyReplicas: number;
    serviceName: string;
    age: string;
    selected: boolean;
  }[]>([]);

  const [daemonSets, setDaemonSets] = useState<{
    name: string;
    namespace: string;
    desired: number;
    current: number;
    ready: number;
    age: string;
    selected: boolean;
  }[]>([]);

  const [replicaSets, setReplicaSets] = useState<{
    name: string;
    namespace: string;
    desired: number;
    current: number;
    ready: number;
    age: string;
    selected: boolean;
  }[]>([]);

  const [jobs, setJobs] = useState<{
    name: string;
    namespace: string;
    completions: number;
    duration: string;
    age: string;
    selected: boolean;
  }[]>([]);

  const [cronJobs, setCronJobs] = useState<{
    name: string;
    namespace: string;
    schedule: string;
    lastSchedule: string;
    age: string;
    selected: boolean;
  }[]>([]);

  // Add networking resources
  const [services, setServices] = useState<{
    name: string;
    namespace: string;
    type: string;
    clusterIP: string;
    externalIP?: string;
    ports: string;
    age: string;
    selected: boolean;
  }[]>([]);

  const [ingresses, setIngresses] = useState<{
    name: string;
    namespace: string;
    hosts: string[];
    tls: boolean;
    age: string;
    selected: boolean;
  }[]>([]);

  // Add configuration resources
  const [configMaps, setConfigMaps] = useState<{
    name: string;
    namespace: string;
    dataCount: number;
    age: string;
    selected: boolean;
  }[]>([]);

  const [secrets, setSecrets] = useState<{
    name: string;
    namespace: string;
    type: string;
    dataCount: number;
    age: string;
    selected: boolean;
  }[]>([]);

  // Add persistent volume claims
  const [persistentVolumeClaims, setPersistentVolumeClaims] = useState<{
    name: string;
    namespace: string;
    status: string;
    volume: string;
    capacity: string;
    accessModes: string[];
    storageClass: string;
    age: string;
    selected: boolean;
  }[]>([]);

  // Compatibility check states
  const [checkingCompatibility, setCheckingCompatibility] = useState(false);
  const [compatibility, setCompatibility] = useState<{ compatible: boolean; issues: string[] }>({
    compatible: false,
    issues: [],
  });

  // Migration progress state
  const [migrationProgress, setMigrationProgress] = useState({ step: 0, message: '' });

  // Add polling cleanup reference with useRef
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add new state for tracking migrated resources
  const [migratedResources, setMigratedResources] = useState({
    pods: 0,
    persistentVolumes: 0,
    namespaces: 0,
    nodes: 0,
    services: 0,
    configMaps: 0,
    secrets: 0,
    deployments: 0,
    statefulSets: 0,
    daemonSets: 0,
    replicaSets: 0,
    jobs: 0,
    cronJobs: 0
  });

  // Load available clusters on component mount
  useEffect(() => {
    const loadClusters = async () => {
      if (!user) return;
      
      setLoadingClusters(true);
      
      try {
        const clusters = await clusterService.getAllClusters(user.id);
        const singleClusters = clusters.filter(c => c.type === 'single');
        const multiTenantClusters = clusters.filter(c => c.type === 'tenant');
        
        setAvailableSingleClusters(singleClusters);
        setAvailableMultiClusters(multiTenantClusters);
        
        // If a cluster ID was provided in the URL, select it as the source
        if (clusterId) {
          const selectedCluster = singleClusters.find(c => c.id === clusterId);
          if (selectedCluster) {
            handleSourceClusterSelect(selectedCluster.id);
          }
        } else if (singleClusters.length > 0) {
          // Auto-select the first single cluster as source if none specified
          handleSourceClusterSelect(singleClusters[0].id);
        }
        
        // Auto-select the first multi-tenant cluster as target if available
        if (multiTenantClusters.length > 0) {
          handleTargetClusterSelect(multiTenantClusters[0].id);
        }
      } catch (error) {
        console.error('Error loading clusters:', error);
        setError('Failed to load available clusters');
      } finally {
        setLoadingClusters(false);
      }
    };
    
    loadClusters();
  }, [user, clusterId]);

  // Handle source cluster selection
  const handleSourceClusterSelect = async (clusterId: string) => {
    const cluster = availableSingleClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    
    setSourceCluster(cluster);
    setSourceConfig({
      clusterName: cluster.name,
      region: cluster.region || 'us-east-1',
      kubeconfig: cluster.kubeconfig,
      useIAMRole: !cluster.kubeconfig
    });
  };

  // Handle target cluster selection
  const handleTargetClusterSelect = async (clusterId: string) => {
    const cluster = availableMultiClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    
    setTargetCluster(cluster);
    setTargetConfig({
      clusterName: cluster.name,
      region: cluster.region || 'us-east-1',
      kubeconfig: cluster.kubeconfig,
      useIAMRole: !cluster.kubeconfig
    });
  };

  // Connect to clusters
  const connectToClusters = async () => {
    // Validate inputs
    if (!sourceConfig.clusterName) {
      toast.error("Source cluster name is required");
      return;
    }
    
    if (!targetConfig.clusterName) {
      toast.error("Target cluster name is required");
      return;
    }

    // Check if kubeconfig or IAM role is provided for both clusters
    if (!sourceConfig.kubeconfig && !sourceConfig.useIAMRole) {
      toast.error("Please provide a kubeconfig or enable IAM role for the source cluster");
      return;
    }

    if (!targetConfig.kubeconfig && !targetConfig.useIAMRole) {
      toast.error("Please provide a kubeconfig or enable IAM role for the target cluster");
      return;
    }

    setStatus('running');
      
      // Connect to source cluster
    const sourceConnected = await connectToEKSCluster(sourceConfig);
    setSourceConnected(sourceConnected);
    
      if (!sourceConnected) {
      setStatus('error');
      setError("Failed to connect to source cluster");
      return;
      }
      
      // Connect to target cluster
    const targetConnected = await connectToEKSCluster(targetConfig);
    setTargetConnected(targetConnected);
    
      if (!targetConnected) {
      setStatus('error');
      setError("Failed to connect to target cluster");
      return;
    }
    
    // If both connections are successful, advance to the next step
    toast.success("Connected to both clusters successfully");
    setCurrentStep(1);
    setProgress(((currentStep + 2) / steps.length) * 100);
      setStatus('idle');
  };

  // Load resources from source cluster following the same pattern as ClusterDetails
  const loadResources = async () => {
    if (!sourceConnected) {
      toast.error("Please connect to the source cluster first");
      return;
    }

    setLoadingResources(true);
    setStatus('running');

    try {
      // Use the same approach as ClusterDetails to organize resources by Kubernetes hierarchy
      console.log('Fetching resources using Kubernetes standard hierarchy');
      console.log('Using sourceConfig:', JSON.stringify({
        clusterName: sourceConfig.clusterName,
        region: sourceConfig.region,
        hasKubeconfig: !!sourceConfig.kubeconfig,
        kubeConfigLength: sourceConfig.kubeconfig ? sourceConfig.kubeconfig.length : 0
      }));
      
      // Step 1: Fetch namespaces first - this matches what ClusterDetails page does
      const namespacesData = await fetch(KUBERNETES_API.GET_NAMESPACES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          kubeconfig: sourceConfig.kubeconfig,
          region: sourceConfig.region,
          clusterName: sourceConfig.clusterName 
        })
      }).then(res => res.json())
        .then(data => data.items?.map((ns: any) => {
          // Calculate age based on creationTimestamp
          const creationTime = ns.metadata?.creationTimestamp ? new Date(ns.metadata.creationTimestamp) : new Date();
          const now = new Date();
          const diffInDays = Math.floor((now.getTime() - creationTime.getTime()) / (1000 * 60 * 60 * 24));
          const age = diffInDays > 0 ? `${diffInDays}d` : 'New';
          
          return {
            name: ns.metadata.name,
            status: ns.status?.phase || 'Active',
            age: age, // Add age property to match Namespace interface
            labels: ns.metadata?.labels || {},
            selected: false
          };
        }) || [])
        .catch(err => {
          console.error('Failed to fetch namespaces:', err);
          return [];
        });
      
      // Fetch core resources in parallel - just like ClusterDetails
      const [nodesData, podsData, pvsData] = await Promise.all([
        getEKSNodes(sourceConfig),
        getEKSPods(sourceConfig),
        getEKSPVs(sourceConfig)
      ]);

      // Fetch workload resources in parallel
      const [deploymentsData, statefulSetsData, daemonSetsData, replicaSetsData, jobsData, cronJobsData] = await Promise.all([
        getEKSDeployments(sourceConfig),
        getEKSStatefulSets(sourceConfig),
        getEKSDaemonSets(sourceConfig),
        getEKSReplicaSets(sourceConfig),
        getEKSJobs(sourceConfig),
        getEKSCronJobs(sourceConfig)
      ]);

      // Fetch networking resources in parallel
      const [servicesData, ingressesData] = await Promise.all([
        getEKSServices(sourceConfig),
        getEKSIngresses(sourceConfig)
      ]);

      // Fetch configuration resources in parallel
      const [configMapsData, secretsData] = await Promise.all([
        getEKSConfigMaps(sourceConfig),
        getEKSSecrets(sourceConfig)
      ]);

      // Fetch storage resources (PVCs)
      const pvcsData = await getEKSPVCs(sourceConfig);

      console.log('Deployments data:', deploymentsData);
      console.log('StatefulSets data:', statefulSetsData);
      console.log('DaemonSets data:', daemonSetsData);
      console.log('ReplicaSets data:', replicaSetsData);
      console.log('Jobs data:', jobsData);
      console.log('CronJobs data:', cronJobsData);
      console.log('Services data:', servicesData);
      console.log('Ingresses data:', ingressesData);
      console.log('ConfigMaps data:', configMapsData);
      console.log('Secrets data:', secretsData);
      console.log('PVCs data:', pvcsData);

      // Set all resources following standard Kubernetes organization
      setNamespaces(namespacesData);
      setNodes(nodesData);
      setPods(podsData);
      setPersistentVolumes(pvsData);
      
      // Set workload resources
      setDeployments(deploymentsData);
      setStatefulSets(statefulSetsData);
      setDaemonSets(daemonSetsData);
      setReplicaSets(replicaSetsData);
      setJobs(jobsData);
      setCronJobs(cronJobsData);

      // Set networking resources
      setServices(servicesData);
      setIngresses(ingressesData);
      
      // Set configuration resources
      setConfigMaps(configMapsData);
      setSecrets(secretsData);
      
      // Set storage resources
      setPersistentVolumeClaims(pvcsData);

      toast.success("Resources loaded successfully");
      setStatus('idle');
    } catch (error) {
      console.error("Failed to load resources:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
      setStatus('error');
      setError(`Failed to load resources: ${(error as Error).message}`);
    } finally {
      setLoadingResources(false);
    }
  };

  // Handle resource selection change (generic function for all resource types)
  const handleResourceSelectionChange = (resourceType: string, resource: any, selected: boolean) => {
    console.log(`Selection changed for ${resourceType}: ${resource.name} -> ${selected}`);
    
    switch(resourceType) {
      case 'namespaces':
        const updatedNamespaces = namespaces.map(ns => 
          ns.name === resource.name ? { ...ns, selected } : ns
        );
        setNamespaces(updatedNamespaces);
        break;
      case 'nodes':
        const updatedNodes = nodes.map(node => 
          node.name === resource.name ? { ...node, selected } : node
        );
        setNodes(updatedNodes);
        break;
      case 'pods':
        const updatedPods = pods.map(p => 
          p.name === resource.name ? { ...p, selected } : p
        );
        setPods(updatedPods);
        break;
      case 'persistentVolumes':
      case 'pvs': // Support alias for backward compatibility
        const updatedPVs = persistentVolumes.map(p => 
          p.name === resource.name ? { ...p, selected } : p
        );
        setPersistentVolumes(updatedPVs);
        break;
      case 'deployments':
        const updatedDeployments = deployments.map(d => 
          d.name === resource.name && d.namespace === resource.namespace ? { ...d, selected } : d
        );
        setDeployments(updatedDeployments);
        break;
      case 'statefulSets':
        const updatedStatefulSets = statefulSets.map(s => 
          s.name === resource.name && s.namespace === resource.namespace ? { ...s, selected } : s
        );
        setStatefulSets(updatedStatefulSets);
        break;
      case 'daemonSets':
        const updatedDaemonSets = daemonSets.map(d => 
          d.name === resource.name && d.namespace === resource.namespace ? { ...d, selected } : d
        );
        setDaemonSets(updatedDaemonSets);
        break;
      case 'replicaSets':
        const updatedReplicaSets = replicaSets.map(r => 
          r.name === resource.name && r.namespace === resource.namespace ? { ...r, selected } : r
        );
        setReplicaSets(updatedReplicaSets);
        break;
      case 'jobs':
        const updatedJobs = jobs.map(j => 
          j.name === resource.name && j.namespace === resource.namespace ? { ...j, selected } : j
        );
        setJobs(updatedJobs);
        break;
      case 'cronJobs':
        const updatedCronJobs = cronJobs.map(c => 
          c.name === resource.name && c.namespace === resource.namespace ? { ...c, selected } : c
        );
        setCronJobs(updatedCronJobs);
        break;
      case 'services':
        const updatedServices = services.map(s => 
          s.name === resource.name && s.namespace === resource.namespace ? { ...s, selected } : s
        );
        setServices(updatedServices);
        break;
      case 'ingresses':
        const updatedIngresses = ingresses.map(i => 
          i.name === resource.name && i.namespace === resource.namespace ? { ...i, selected } : i
        );
        setIngresses(updatedIngresses);
        break;
      case 'configMaps':
        const updatedConfigMaps = configMaps.map(cm => 
          cm.name === resource.name && cm.namespace === resource.namespace ? { ...cm, selected } : cm
        );
        setConfigMaps(updatedConfigMaps);
        break;
      case 'secrets':
        const updatedSecrets = secrets.map(s => 
          s.name === resource.name && s.namespace === resource.namespace ? { ...s, selected } : s
        );
        setSecrets(updatedSecrets);
        break;
      case 'persistentVolumeClaims':
      case 'pvcs': // Support alias for backward compatibility
        const updatedPVCs = persistentVolumeClaims.map(p => 
          p.name === resource.name && p.namespace === resource.namespace ? { ...p, selected } : p
        );
        setPersistentVolumeClaims(updatedPVCs);
        break;
      default:
        console.log(`Selection change for ${resourceType} not yet implemented`);
    }
  };

  // Handle select all functionality for any resource type
  const handleSelectAll = (resourceType: string, selectAll: boolean) => {
    console.log(`Selecting all ${resourceType} resources: ${selectAll}`);
    
    switch(resourceType) {
      case 'namespaces':
        const updatedNamespaces = namespaces.map(ns => ({ ...ns, selected: selectAll }));
        setNamespaces(updatedNamespaces);
        break;
      case 'nodes':
        const updatedNodes = nodes.map(node => ({ ...node, selected: selectAll }));
        setNodes(updatedNodes);
        break;
      case 'pods':
        const updatedPods = pods.map(pod => ({ ...pod, selected: selectAll }));
        setPods(updatedPods);
        break;
      case 'persistentVolumes':
      case 'pvs': // Support alias
        const updatedPVs = persistentVolumes.map(pv => ({ ...pv, selected: selectAll }));
        setPersistentVolumes(updatedPVs);
        break;
      case 'deployments':
        const updatedDeployments = deployments.map(d => ({ ...d, selected: selectAll }));
        setDeployments(updatedDeployments);
        break;
      case 'statefulSets':
        const updatedStatefulSets = statefulSets.map(s => ({ ...s, selected: selectAll }));
        setStatefulSets(updatedStatefulSets);
        break;
      case 'daemonSets':
        const updatedDaemonSets = daemonSets.map(d => ({ ...d, selected: selectAll }));
        setDaemonSets(updatedDaemonSets);
        break;
      case 'replicaSets':
        const updatedReplicaSets = replicaSets.map(r => ({ ...r, selected: selectAll }));
        setReplicaSets(updatedReplicaSets);
        break;
      case 'jobs':
        const updatedJobs = jobs.map(j => ({ ...j, selected: selectAll }));
        setJobs(updatedJobs);
        break;
      case 'cronJobs':
        const updatedCronJobs = cronJobs.map(c => ({ ...c, selected: selectAll }));
        setCronJobs(updatedCronJobs);
        break;
      // Add new cases for networking resources
      case 'services':
        const updatedServices = services.map(s => ({ ...s, selected: selectAll }));
        setServices(updatedServices);
        break;
      case 'ingresses':
        const updatedIngresses = ingresses.map(i => ({ ...i, selected: selectAll }));
        setIngresses(updatedIngresses);
        break;
      // Add new cases for configuration resources
      case 'configMaps':
        const updatedConfigMaps = configMaps.map(cm => ({ ...cm, selected: selectAll }));
        setConfigMaps(updatedConfigMaps);
        break;
      case 'secrets':
        const updatedSecrets = secrets.map(s => ({ ...s, selected: selectAll }));
        setSecrets(updatedSecrets);
        break;
      // Add new cases for storage resources
      case 'persistentVolumeClaims':
      case 'pvcs': // Support alias for backward compatibility
        const updatedPVCs = persistentVolumeClaims.map(p => ({ ...p, selected: selectAll }));
        setPersistentVolumeClaims(updatedPVCs);
        break;
      default:
        console.log(`Select all for ${resourceType} not yet implemented`);
    }
  };

  // Proceed to compatibility check
  const proceedToCompatibilityCheck = async () => {
    // Check if any resources are selected across all resource types
    const selectedNamespaces = namespaces.filter(ns => ns.selected).length;
    const selectedNodes = nodes.filter(node => node.selected).length;
    const selectedPods = pods.filter(pod => pod.selected).length;
    const selectedPVs = persistentVolumes.filter(pv => pv.selected).length;
    const selectedDeployments = deployments.filter(d => d.selected).length;
    const selectedStatefulSets = statefulSets.filter(s => s.selected).length;
    const selectedDaemonSets = daemonSets.filter(d => d.selected).length;
    const selectedReplicaSets = replicaSets.filter(r => r.selected).length;
    const selectedJobs = jobs.filter(j => j.selected).length;
    const selectedCronJobs = cronJobs.filter(c => c.selected).length;
    
    const totalSelected = selectedNamespaces + selectedNodes + selectedPods + selectedPVs +
                          selectedDeployments + selectedStatefulSets + selectedDaemonSets + 
                          selectedReplicaSets + selectedJobs + selectedCronJobs;
    
    console.log(`Selected resources: ${selectedNamespaces} namespaces, ${selectedNodes} nodes, ${selectedPods} pods, ${selectedPVs} PVs, ${selectedDeployments} deployments, ${selectedStatefulSets} statefulSets, ${selectedDaemonSets} daemonSets, ${selectedReplicaSets} replicaSets, ${selectedJobs} jobs, ${selectedCronJobs} cronJobs`);
    
    if (totalSelected === 0) {
      toast.error("Please select at least one resource to migrate");
      return;
    }
    
    setCheckingCompatibility(true);
    setStatus('running');
    
    try {
      // Check compatibility between clusters
      const compatibilityResult = await checkClusterCompatibility(sourceConfig, targetConfig);
      setCompatibility(compatibilityResult);
      
      // Move to next step with consistent progress calculation
      setCurrentStep(2);
      setProgress((3 / steps.length) * 100);
      setStatus('idle');
    } catch (error) {
      console.error("Compatibility check failed:", error);
      setStatus('error');
      setError(`Compatibility check failed: ${(error as Error).message}`);
    } finally {
      setCheckingCompatibility(false);
    }
  };

  // Add effect to clean up polling on unmount
  useEffect(() => {
    return () => {
      // Cleanup polling if component unmounts during migration
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        console.log('Cleaned up migration polling on unmount');
      }
    };
  }, []);

  // Handle migration execution
  const handleStartMigration = async () => {
    try {
      setStatus('running');
      setProgress((3 / steps.length) * 100);
      
      // Filter only selected resources for all resource types
      const selectedNamespacesToMigrate = namespaces.filter(ns => ns.selected);
      const selectedNodesToMigrate = nodes.filter(node => node.selected);
      const selectedPodsToMigrate = pods.filter(pod => pod.selected);
      const selectedPVsToMigrate = persistentVolumes.filter(pv => pv.selected);
      const selectedDeploymentsToMigrate = deployments.filter(d => d.selected);
      const selectedStatefulSetsToMigrate = statefulSets.filter(s => s.selected);
      const selectedDaemonSetsToMigrate = daemonSets.filter(d => d.selected);
      const selectedReplicaSetsToMigrate = replicaSets.filter(r => r.selected);
      const selectedJobsToMigrate = jobs.filter(j => j.selected);
      const selectedCronJobsToMigrate = cronJobs.filter(c => c.selected);
      
      // Add filtering for new resource types
      const selectedServicesToMigrate = services.filter(s => s.selected);
      const selectedIngressesToMigrate = ingresses.filter(i => i.selected);
      const selectedConfigMapsToMigrate = configMaps.filter(cm => cm.selected);
      const selectedSecretsToMigrate = secrets.filter(s => s.selected);
      const selectedPVCsToMigrate = persistentVolumeClaims.filter(p => p.selected);
      
      // Count total selected resources across all types
      const totalSelected = selectedNamespacesToMigrate.length + selectedNodesToMigrate.length + 
                           selectedPodsToMigrate.length + selectedPVsToMigrate.length +
                           selectedDeploymentsToMigrate.length + selectedStatefulSetsToMigrate.length + 
                           selectedDaemonSetsToMigrate.length + selectedReplicaSetsToMigrate.length + 
                           selectedJobsToMigrate.length + selectedCronJobsToMigrate.length +
                           selectedServicesToMigrate.length + selectedIngressesToMigrate.length +
                           selectedConfigMapsToMigrate.length + selectedSecretsToMigrate.length +
                           selectedPVCsToMigrate.length;
      
      console.log(`Selected for migration: ${selectedNamespacesToMigrate.length} namespaces, ${selectedNodesToMigrate.length} nodes, ${selectedPodsToMigrate.length} pods, ${selectedPVsToMigrate.length} PVs, ${selectedDeploymentsToMigrate.length} deployments, ${selectedStatefulSetsToMigrate.length} statefulSets, ${selectedDaemonSetsToMigrate.length} daemonSets, ${selectedReplicaSetsToMigrate.length} replicaSets, ${selectedJobsToMigrate.length} jobs, ${selectedCronJobsToMigrate.length} cronJobs`);
      
      // We shouldn't need this check since the button is disabled if nothing is selected,
      // but keeping it as a safety measure
      if (totalSelected === 0) {
        toast.error("No resources selected for migration");
        setStatus('idle');
        return;
      }
      
      // Convert to resource format expected by the API
      const resources = [
        // Include namespaces
        ...selectedNamespacesToMigrate.map(ns => ({
          kind: 'Namespace',
          namespace: '',  // Namespaces don't have a parent namespace
          name: ns.name
        })),
        // Include nodes - nodes are cluster-scoped resources
        ...selectedNodesToMigrate.map(node => ({
          kind: 'Node',
          namespace: '',  // Nodes are cluster-level resources
          name: node.name
        })),
        // Include pods - pods are namespaced resources
        ...selectedPodsToMigrate.map(pod => ({
          kind: 'Pod',
          namespace: pod.namespace || 'default',
          name: pod.name
        })),
        // Include persistent volumes
        ...selectedPVsToMigrate.map(pv => ({
          kind: 'PersistentVolume',
          namespace: '', // PVs are cluster-scoped resources, not namespaced
          name: pv.name
        })),
        // Include deployments
        ...selectedDeploymentsToMigrate.map(d => ({
          kind: 'Deployment',
          namespace: d.namespace || 'default',
          name: d.name
        })),
        // Include statefulSets
        ...selectedStatefulSetsToMigrate.map(s => ({
          kind: 'StatefulSet',
          namespace: s.namespace || 'default',
          name: s.name
        })),
        // Include daemonSets
        ...selectedDaemonSetsToMigrate.map(d => ({
          kind: 'DaemonSet',
          namespace: d.namespace || 'default',
          name: d.name
        })),
        // Include replicaSets
        ...selectedReplicaSetsToMigrate.map(r => ({
          kind: 'ReplicaSet',
          namespace: r.namespace || 'default',
          name: r.name
        })),
        // Include jobs
        ...selectedJobsToMigrate.map(j => ({
          kind: 'Job',
          namespace: j.namespace || 'default',
          name: j.name
        })),
        // Include cronJobs
        ...selectedCronJobsToMigrate.map(c => ({
          kind: 'CronJob',
          namespace: c.namespace || 'default',
          name: c.name
        })),
        // Include networking resources
        ...selectedServicesToMigrate.map(s => ({
          kind: 'Service',
          namespace: s.namespace || 'default',
          name: s.name
        })),
        ...selectedIngressesToMigrate.map(i => ({
          kind: 'Ingress',
          namespace: i.namespace || 'default',
          name: i.name
        })),
        // Include configuration resources
        ...selectedConfigMapsToMigrate.map(cm => ({
          kind: 'ConfigMap',
          namespace: cm.namespace || 'default',
          name: cm.name
        })),
        ...selectedSecretsToMigrate.map(s => ({
          kind: 'Secret',
          namespace: s.namespace || 'default',
          name: s.name
        })),
        // Include storage resources
        ...selectedPVCsToMigrate.map(p => ({
          kind: 'PersistentVolumeClaim',
          namespace: p.namespace || 'default',
          name: p.name
        })),
      ];
      
      // Set up migration options
      const migrationOptions = {
        targetNamespace: 'default', // Default target namespace
        migrateVolumes: true,
        preserveNodeAffinity: false
      };
      
      // Start migration using the service
      const migrationId = await MigrationService.migrateResources(
        sourceConfig.kubeconfig!,
        targetConfig.kubeconfig!,
        resources,
        migrationOptions
      );
      
      // Update UI right away to show initial progress
      setMigrationProgress({
        step: 1,
        message: 'Starting migration: Preparing resources'
      });
      
      // Helper function to convert migration step strings to step numbers for UI progress
      const getStepNumberFromStatus = (stepString: string): number => {
        if (!stepString) return 1;
        
        // Map common step strings to step numbers
        if (stepString.includes('Initializing') || stepString.includes('Preparing')) return 1;
        if (stepString.includes('Namespace')) return 2;
        if (stepString.includes('ConfigMap') || stepString.includes('Secret')) return 2;
        if (stepString.includes('PersistentVolume')) return 3;
        if (stepString.includes('Service') || stepString.includes('Ingress')) return 3;
        if (stepString.includes('Deployment') || stepString.includes('StatefulSet') || 
            stepString.includes('DaemonSet') || stepString.includes('Job')) return 4;
        if (stepString.includes('Pod')) return 4;
        if (stepString.includes('Completed') || stepString.includes('Finalizing')) return 5;
        
        // Default to step 3 (middle step) if not recognized
        return 3;
      };
      
      // Define a function to poll migration status
      const pollMigrationStatus = async () => {
        try {
          const migrationStatus = await MigrationService.getMigrationStatus(migrationId);
          console.log(`Migration status update:`, migrationStatus);
          
          if (migrationStatus.status === 'completed') {
            // Track successfully migrated resources by type
            const migratedResourceCounts = migrationStatus.migratedResources || {};
            
            // Calculate total migrated resources from the status
            const totalMigrated = migrationStatus.resourcesMigrated || 0;
            
            // If we have specific resource counts, use them
            // Otherwise, infer from the total based on resource types
            setMigratedResources({
              pods: migratedResourceCounts.Pod || 0,
              persistentVolumes: migratedResourceCounts.PersistentVolume || 0,
              namespaces: migratedResourceCounts.Namespace || (migrationStatus.currentStep.includes('Namespace') ? totalMigrated : 0),
              nodes: migratedResourceCounts.Node || 0,
              services: migratedResourceCounts.Service || 0,
              configMaps: migratedResourceCounts.ConfigMap || 0,
              secrets: migratedResourceCounts.Secret || 0,
              deployments: migratedResourceCounts.Deployment || 0,
              statefulSets: migratedResourceCounts.StatefulSet || 0,
              daemonSets: migratedResourceCounts.DaemonSet || 0,
              replicaSets: migratedResourceCounts.ReplicaSet || 0,
              jobs: migratedResourceCounts.Job || 0,
              cronJobs: migratedResourceCounts.CronJob || 0
            });
            
            setStatus('completed');
            setProgress(100);
            setMigrationProgress({
              step: 5,
              message: `Migration completed successfully: ${migrationStatus.resourcesMigrated}/${migrationStatus.resourcesTotal} resources migrated`
            });
            toast.success(`Migration completed successfully!`);
            setCurrentStep(4);
            return;
          } else if (migrationStatus.status === 'failed') {
            setStatus('error');
            setError(migrationStatus.error || 'Migration failed with an unknown error');
            toast.error(`Migration failed: ${migrationStatus.error || 'Unknown error'}`);
            return;
          } else {
            // Still running, update progress
            const stepNumber = getStepNumberFromStatus(migrationStatus.currentStep);
            const progressPercent = Math.floor((migrationStatus.resourcesMigrated / migrationStatus.resourcesTotal) * 100);
            
            setMigrationProgress({
              step: stepNumber,
              message: `${migrationStatus.currentStep}: ${migrationStatus.resourcesMigrated}/${migrationStatus.resourcesTotal} resources`
            });
            
            // Update main progress bar based on both step and resource completion
            const stepProgress = ((3 + (stepNumber / 5)) / steps.length) * 100;
            const combinedProgress = Math.max(stepProgress, (3 / steps.length) * 100 + progressPercent * (1 / steps.length));
            setProgress(Math.min(combinedProgress, 80)); // Cap at 80% until fully complete
            
            // Continue polling
            pollTimeoutRef.current = setTimeout(pollMigrationStatus, 5000);
          }
        } catch (error) {
          console.error(`Error polling migration status:`, error);
          pollTimeoutRef.current = setTimeout(pollMigrationStatus, 5000);
        }
      };
      
      // Start polling
      pollTimeoutRef.current = setTimeout(pollMigrationStatus, 5000);
      
    } catch (error) {
      console.error('Migration failed:', error);
      setStatus('error');
      setError(`Migration failed: ${(error as Error).message}`);
      toast.error(`Migration failed: ${(error as Error).message}`);
    }
  };

  // Reset migration process
  const resetMigration = () => {
    // Reset all state variables
    setCurrentStep(0);
    setProgress(0);
    setStatus('idle');
    setError(null);
    
    // IMPROVED: Also reset cluster selections and configs
    setSourceConnected(false);
    setTargetConnected(false);
    setSourceCluster(null);
    setTargetCluster(null);
    setSourceConfig({
      clusterName: '',
      region: 'us-east-1',
      useIAMRole: false,
    });
    setTargetConfig({
      clusterName: '',
      region: 'us-east-1',
      useIAMRole: false,
    });
    
    // Reset resource selections
    setNamespaces([]);
    setNodes([]);
    setPods([]);
    setPersistentVolumes([]);
    setDeployments([]);
    setStatefulSets([]);
    setDaemonSets([]);
    setReplicaSets([]);
    setJobs([]);
    setCronJobs([]);
    setCompatibility({ compatible: false, issues: [] });
    setMigrationProgress({ step: 0, message: '' });
    
    // Clear any polling timeout
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  // Finish migration and navigate back to dashboard
  const finishMigration = () => {
    // First ensure the cluster is updated properly in Supabase
    if (sourceCluster && status === 'completed') {
      // Force a refresh of the dashboard by navigating with a timestamp parameter
      // This ensures the dashboard will reload cluster data from Supabase
      toast.success("Migration completed and saved. Redirecting to dashboard...");
      navigate('/dashboard?refresh=' + Date.now());
    } else if (status === 'error') {
      // If there was an error, we'll go to the dashboard anyway
      toast.error("Migration had errors - please check your cluster status");
      navigate('/dashboard');
    } else {
    navigate('/dashboard');
    }
  };

  // Render appropriate content for current step
  const renderStepContent = () => {
    switch(currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Source Cluster Configuration</CardTitle>
                <CardDescription>
                  Select a single cluster as your migration source
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingClusters ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span>Loading clusters...</span>
                  </div>
                ) : availableSingleClusters.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No single clusters available for migration</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/create-cluster')}
                    >
                      Create Single Cluster
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="source-cluster">Select Source Cluster</Label>
                      <Select 
                        value={sourceCluster?.id || ''} 
                        onValueChange={handleSourceClusterSelect}
                        disabled={sourceConnected}
                      >
                        <SelectTrigger id="source-cluster" className="w-full">
                          <SelectValue placeholder="Select a single cluster" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSingleClusters.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                              {cluster.name} ({cluster.region}) - {cluster.nodes} node(s)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  
                    {sourceCluster && (
            <AWSClusterConfig
              config={sourceConfig}
              onChange={setSourceConfig}
                        title="Source Cluster"
                        readOnly={sourceConnected}
                        clusterData={sourceCluster}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Target Cluster Configuration</CardTitle>
                <CardDescription>
                  Select a multi-tenant as your migration target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingClusters ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span>Loading clusters...</span>
                  </div>
                ) : availableMultiClusters.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No multi-tenant clusters available as target</p>
                    <p className="text-sm text-muted-foreground mb-4">You need at least one multi-tenant cluster for migration.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/create-cluster')}
                    >
                      Create Multi-Tenant Cluster
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="target-cluster">Select Target Cluster</Label>
                      <Select 
                        value={targetCluster?.id || ''} 
                        onValueChange={handleTargetClusterSelect}
                        disabled={targetConnected}
                      >
                        <SelectTrigger id="target-cluster" className="w-full">
                          <SelectValue placeholder="Select a multi-tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMultiClusters.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                              {cluster.name} ({cluster.region}) - {cluster.nodes} node(s)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {targetCluster && (
            <AWSClusterConfig
              config={targetConfig}
              onChange={setTargetConfig}
                        title="Target Cluster"
                        readOnly={targetConnected}
                        clusterData={targetCluster}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 1:
        console.log('ResourceInventory props:', {
          namespaces: namespaces.length,
          nodes: nodes.length,
          pods: pods.length,
          persistentVolumes: persistentVolumes.length,
          deployments: deployments.length,
          statefulSets: statefulSets.length,
          daemonSets: daemonSets.length,
          replicaSets: replicaSets.length,
          jobs: jobs.length,
          cronJobs: cronJobs.length
        });
        return (
          <div className="space-y-6 py-4">
            <ResourceInventory
              namespaces={namespaces}
              nodes={nodes}
              pods={pods}
              deployments={deployments}
              statefulSets={statefulSets}
              daemonSets={daemonSets}
              replicaSets={replicaSets}
              jobs={jobs}
              cronJobs={cronJobs}
              services={services}
              ingresses={ingresses}
              configMaps={configMaps}
              secrets={secrets}
              persistentVolumes={persistentVolumes}
              persistentVolumeClaims={persistentVolumeClaims}
              sourceCluster={sourceCluster}
              isLoading={loadingResources}
              loadResources={loadResources}
              onResourceSelectionChange={handleResourceSelectionChange}
              onSelectAll={handleSelectAll}
            />
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6 py-4">
            <CompatibilityCheck
              sourceConfig={sourceConfig}
              targetConfig={targetConfig}
              compatibilityResult={compatibility}
              namespaces={namespaces}
              nodes={nodes}
              pods={pods}
              persistentVolumes={persistentVolumes}
              deployments={deployments}
              statefulSets={statefulSets}
              daemonSets={daemonSets}
              replicaSets={replicaSets}
              jobs={jobs}
              cronJobs={cronJobs}
              services={services}
              ingresses={ingresses}
              configMaps={configMaps}
              secrets={secrets}
              persistentVolumeClaims={persistentVolumeClaims}
            />
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Migration Progress</CardTitle>
                <CardDescription>
                  Status of the migration process for {sourceConfig.clusterName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Progress value={status === 'completed' ? 100 : (migrationProgress.step / 5) * 100} className="w-full" />
                
                <div className="space-y-3">
                  {[
                    "Exporting resources from source cluster", 
                    "Transforming resource manifests", 
                    "Deploying resources to target cluster", 
                    "Migrating persistent volumes", 
                    "Verifying successful migration"
                  ].map((step, index) => (
                    <div key={index} className="flex items-center">
                      {migrationProgress.step > index ? (
                        <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center mr-3">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : migrationProgress.step === index ? (
                        <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center animate-pulse mr-3">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-200 dark:border-gray-700 mr-3" />
                      )}
                      <span className={migrationProgress.step >= index ? 'text-foreground' : 'text-muted-foreground'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                
                {migrationProgress.message && (
                  <div className="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-md text-sm text-primary-700 dark:text-primary-300">
                    {migrationProgress.message}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Migration Complete</CardTitle>
                <CardDescription>
                  Your cluster has been successfully migrated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center py-6">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-medium">Migration Successful</h3>
                  <p className="text-muted-foreground text-center max-w-md mt-2">
                    {sourceConfig.clusterName} has been successfully migrated to a multi-tenant setup
                    with {targetConfig.clusterName}.
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-md">
                  <h4 className="font-medium text-green-800 dark:text-green-300 mb-2">Migration Summary</h4>
                  <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                    {migrationProgress.message && (
                      <li className="flex items-center">
                        <Check className="h-4 w-4 mr-2" />
                        {migrationProgress.message}
                      </li>
                    )}
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Updated cluster type from single to multi-tenant
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Created new kubeconfig for multi-tenant setup
                    </li>
                    {status === 'completed' && migrationProgress.step === 5 && !migrationProgress.message.includes('resources migrated') && (
                      <li className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        No resources were migrated. Please check your resource selection.
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Render appropriate buttons for current step
  const renderStepButtons = () => {
    switch(currentStep) {
      case 0:
    return (
            <>
              <Button 
                variant="outline" 
              onClick={() => navigate('/dashboard')}
              >
              Cancel
              </Button>
              <Button 
                onClick={connectToClusters}
                disabled={
                status === 'running' || 
                !sourceCluster || 
                !targetCluster || 
                availableSingleClusters.length === 0 || 
                availableMultiClusters.length === 0
              }
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect Clusters <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
            </Button>
          </>
        );
          
      case 1:
        return (
          <>
            <Button 
              variant="outline"
              onClick={() => {
              setCurrentStep(0);
                setProgress((1 / steps.length) * 100);
              }}
            >
              Back
            </Button>
            <Button 
              onClick={proceedToCompatibilityCheck}
              disabled={
                status === 'running' || 
                (namespaces.filter(ns => ns.selected).length + 
                nodes.filter(node => node.selected).length + 
                pods.filter(pod => pod.selected).length + 
                persistentVolumes.filter(pv => pv.selected).length + 
                deployments.filter(d => d.selected).length + 
                statefulSets.filter(s => s.selected).length + 
                daemonSets.filter(d => d.selected).length + 
                replicaSets.filter(r => r.selected).length + 
                jobs.filter(j => j.selected).length + 
                cronJobs.filter(c => c.selected).length + 
                services.filter(s => s.selected).length + 
                ingresses.filter(i => i.selected).length + 
                configMaps.filter(cm => cm.selected).length + 
                secrets.filter(s => s.selected).length + 
                persistentVolumeClaims.filter(pvc => pvc.selected).length) === 0
              }
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        );
        
      case 2:
        return (
          <>
            <Button 
              variant="outline"
              onClick={() => {
              setCurrentStep(1);
                setProgress((2 / steps.length) * 100);
              }}
            >
              Back
            </Button>
            <Button 
              onClick={handleStartMigration} 
              disabled={status === 'running' || !compatibility.compatible}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Start Migration <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        );
        
      case 3:
        return (
          <>
            {status === 'error' ? (
              <>
              <Button 
                variant="outline" 
                  onClick={resetMigration}
              >
                  Restart
              </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </>
            ) : status === 'completed' ? (
              <Button 
                variant="outline" 
                disabled
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </Button>
            )}
          </>
        );
        
      case 4:
    return (
          <>
            <Button
              variant="outline"
              onClick={resetMigration}
            >
              Start New Migration
            </Button>
            <Button
              onClick={finishMigration}
            >
              Finish
            </Button>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
        
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`
                flex flex-col items-center
                ${index === currentStep ? 'text-primary' : 'text-muted-foreground'}
                ${index < currentStep ? 'text-primary' : ''}
              `}
            >
              <div className={`
                flex h-8 w-8 items-center justify-center rounded-full border border-primary 
                ${index < currentStep ? 'bg-primary text-primary-foreground' : 'border-muted-foreground'}
                ${index === currentStep ? 'bg-primary text-primary-foreground' : ''}
              `}>
                {index < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="mt-2 text-sm font-medium">{step.title}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderStepContent()}
          </CardContent>
          <CardFooter className="flex justify-between">
        {renderStepButtons()}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default MigrationWizard;