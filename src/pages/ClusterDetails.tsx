import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/supabase';
import { KUBERNETES_API, apiRequest } from '@/utils/api';
import { fetchClusterStatus, parseKubeContexts, parseKubeClusters } from '@/utils/kubernetes';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Server, 
  Globe, 
  Clock, 
  Cpu, 
  Calendar, 
  AlertTriangle,
  DownloadCloud,
  RefreshCw,
  Trash2,
  Check,
  X,
  Loader2,
  Database,
  BarChart3,
  Activity,
  CheckCircle2,
  AlertCircle,
  Network,
  HelpCircle,
  Edit3,
  Save,
  Copy,
  User as UserIcon,
  Cloud,
  ShieldAlert,
  Users,
  LayoutGrid,
  HardDrive,
  Info,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import MigrationService, { ResourceToMigrate } from '@/services/MigrationService';
import TenantResources from '@/components/clusters/TenantResources';
import { Separator } from '@/components/ui/separator';

const ClusterDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cluster, setCluster] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for live cluster data
  const [liveClusterStatus, setLiveClusterStatus] = useState<any>(null);
  const [isLoadingLiveStatus, setIsLoadingLiveStatus] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [contexts, setContexts] = useState<any[]>([]);
  const [clusterConfigs, setClusterConfigs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('nodes');
  const [liveStatusError, setLiveStatusError] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const MAX_FAILURES_BEFORE_STATUS_UPDATE = 3;
  const [connectionFailed, setConnectionFailed] = useState(false);

  // New state for pod details dialog
  const [selectedPod, setSelectedPod] = useState<any>(null);
  const [isPodDetailsOpen, setIsPodDetailsOpen] = useState(false);
  const [podYaml, setPodYaml] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedYaml, setEditedYaml] = useState<string>('');
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<Cluster[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<{[key: string]: boolean}>({});

  // New state for namespaces and services
  // Namespace section
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);
  
  // Node section
  const [nodes, setNodes] = useState<any[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  
  // Workloads section
  const [pods, setPods] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [replicaSets, setReplicaSets] = useState<any[]>([]);
  const [statefulSets, setStatefulSets] = useState<any[]>([]);
  const [daemonSets, setDaemonSets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [isLoadingWorkloads, setIsLoadingWorkloads] = useState(false);
  const [workloadsTab, setWorkloadsTab] = useState<string>('pods');
  
  // Networking section
  const [services, setServices] = useState<any[]>([]);
  const [ingresses, setIngresses] = useState<any[]>([]);
  const [isLoadingNetworking, setIsLoadingNetworking] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [networkingTab, setNetworkingTab] = useState<string>('services');
  
  // Configurations section
  const [configMaps, setConfigMaps] = useState<any[]>([]);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [resourceQuotas, setResourceQuotas] = useState<any[]>([]);
  const [limitRanges, setLimitRanges] = useState<any[]>([]);
  const [isLoadingConfigurations, setIsLoadingConfigurations] = useState(false);
  const [configurationsTab, setConfigurationsTab] = useState<string>('configmaps');
  
  // Storage section
  const [persistentVolumes, setPersistentVolumes] = useState<any[]>([]);
  const [persistentVolumeClaims, setPersistentVolumeClaims] = useState<any[]>([]);
  const [storageClasses, setStorageClasses] = useState<any[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [storageTab, setStorageTab] = useState<string>('pv');
  
  // Cluster Info
  const [kubeConfigDetails, setKubeConfigDetails] = useState<any>(null);
  const [isLoadingKubeConfigDetails, setIsLoadingKubeConfigDetails] = useState(false);
  
  // Monitoring & Logging
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);

  // Migration state
  const [selectedComponents, setSelectedComponents] = useState<{[key: string]: boolean}>({});
  const [componentCounts, setComponentCounts] = useState<{[key: string]: number}>({});
  const [isMigrationLoading, setIsMigrationLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'in-progress' | 'completed' | 'failed'>('idle');
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migrationYaml, setMigrationYaml] = useState<string>('');
  const [isMigrationYamlOpen, setIsMigrationYamlOpen] = useState(false);
  const [targetCluster, setTargetCluster] = useState<Cluster | null>(null);
  const [availableTargetClusters, setAvailableTargetClusters] = useState<Cluster[]>([]);
  const [isLoadingTargetClusters, setIsLoadingTargetClusters] = useState(false);
  const [showMigrationOptions, setShowMigrationOptions] = useState(false);
  const [migrationOptions, setMigrationOptions] = useState<{
    targetNamespace: string,
    preserveNodeAffinity: boolean,
    migrateVolumes: boolean
  }>({
    targetNamespace: '',
    preserveNodeAffinity: false,
    migrateVolumes: false
  });
  const [resourceType, setResourceType] = useState<string>('deployments');

  // Function to fetch namespaces
  const fetchNamespaces = async (kubeconfig: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingNamespaces(true);
    console.log("Attempting to fetch namespaces with POST request...");
    
    try {
      // Explicitly log the API endpoint we're calling
      console.log("Calling API endpoint:", KUBERNETES_API.GET_NAMESPACES);
      
      const namespacesData = await apiRequest(
        KUBERNETES_API.GET_NAMESPACES,
        'POST',
        { kubeconfig }
      );
      
      // Log the response to help with debugging
      console.log("Namespaces API response:", namespacesData);
      
      if (namespacesData && namespacesData.items) {
        // Map to a consistent format
        const namespacesList = namespacesData.items.map((ns: any) => ({
          name: ns.metadata.name,
          status: ns.status?.phase || 'Active',
          creationTimestamp: ns.metadata.creationTimestamp,
          labels: ns.metadata.labels || {},
          annotations: ns.metadata.annotations || {}
        }));
        
        console.log("Processed namespaces:", namespacesList);
        setNamespaces(namespacesList);
        
        // Set default namespace and fetch resources for it
        if (namespacesList.length > 0) {
          const defaultNs = namespacesList.find((ns: any) => ns.name === 'default') || namespacesList[0];
          setSelectedNamespace(defaultNs.name);
          fetchResourcesForNamespace(kubeconfig, defaultNs.name);
        } else {
          console.warn("No namespaces returned from API");
        }
      } else {
        console.error("API returned a response but no namespace items were found:", namespacesData);
        setNamespaces([]);
      }
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      // Don't use mock data, but show the error in UI
      toast.error('Failed to fetch namespaces: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setNamespaces([]);
    } finally {
      setIsLoadingNamespaces(false);
    }
  };

  useEffect(() => {
    const loadCluster = async () => {
      if (!user || !id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await clusterService.getClusterById(id);
        if (data) {
          setCluster(data);
          
          // Parse kubeconfig for additional context
          if (data.kubeconfig) {
            const parsedContexts = parseKubeContexts(data.kubeconfig);
            const parsedClusters = parseKubeClusters(data.kubeconfig);
            setContexts(parsedContexts);
            setClusterConfigs(parsedClusters);
            
            // Fetch kubeconfig details, namespaces and initial services
            fetchKubeConfigDetails(data.kubeconfig);
            fetchNamespaces(data.kubeconfig);
          }
          
          // Start fetching live status
          fetchLiveStatus(data.kubeconfig);
          
          // Check if connectivity check was requested via URL
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('check') === 'connectivity') {
            // Remove the parameter to avoid repeated checks
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Add a small delay to ensure fetchLiveStatus has completed
            setTimeout(() => {
              handleManualRefresh();
              toast.info('Performing connectivity check...');
            }, 500);
          }
        } else {
          setError('Cluster not found');
        }
      } catch (err) {
        console.error('Error loading cluster:', err);
        setError('Failed to load cluster details');
        toast.error('Failed to load cluster details');
      } finally {
        setIsLoading(false);
      }
    };

    loadCluster();
    
    // Cleanup function to clear auto-refresh timer
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [user, id]);
  
  // Function to fetch live cluster status
  const fetchLiveStatus = async (kubeconfig?: string) => {
    if (!kubeconfig) return;
    
    try {
      setIsLoadingLiveStatus(true);
      setConnectionFailed(false);
      setLiveStatusError(null);
      
      // Get Kubernetes current context
      const contextInfo = await fetchKubeConfigDetails(kubeconfig);
      
      // Fetch cluster status data
      const status = await fetchClusterStatus(kubeconfig);
      
      if (status) {
        // Success path
        setLiveClusterStatus(status);
        setLastUpdated(new Date().toISOString());
        setLiveStatusError(null);
        setConsecutiveFailures(0);
        setConnectionFailed(false);
        
        // Fetch all resources based on the Kubernetes hierarchy
        fetchNamespaces(kubeconfig);
        // Call the fetchNodes function
        if (typeof fetchNodes === 'function') {
          fetchNodes(kubeconfig);
        }
        
        // If we have a selected namespace, fetch namespace-specific resources
        if (selectedNamespace) {
          fetchResourcesForNamespace(kubeconfig, selectedNamespace);
        }
        
        // Check if cluster is of a type that might have EKS information
        if (cluster && !cluster.eks_cluster_name && status && (status as any).clusterName) {
          // Update cluster data with EKS name if found
          const updatedCluster = {
            ...cluster,
            eks_cluster_name: (status as any).clusterName || ''
          } as Cluster;
          setCluster(updatedCluster);
          
          // Attempt to update in DB if cluster entity exists
          if (cluster.id) {
            clusterService.updateCluster(cluster.id, {
              eks_cluster_name: (status as any).clusterName || ''
            });
          }
        }
      } else {
        // Error handling
        setConsecutiveFailures(prev => prev + 1);
        setConnectionFailed(consecutiveFailures >= MAX_FAILURES_BEFORE_STATUS_UPDATE);
        
        if (cluster && cluster.status !== 'failed' && 
            consecutiveFailures >= MAX_FAILURES_BEFORE_STATUS_UPDATE) {
          // Update cluster status to failed if too many consecutive failures
          const updatedCluster = {
            ...cluster,
            status: 'failed' as "running" | "pending" | "failed"
          } as Cluster;
          setCluster(updatedCluster);
          
          // Update in DB if cluster entity exists
          if (cluster.id) {
            clusterService.updateCluster(cluster.id, { status: 'failed' });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching live status:', error);
      setLiveStatusError('Failed to connect to the cluster');
      setLiveClusterStatus(null);
      // Set specific error messages based on error type
      let errorMessage = 'Failed to fetch live cluster status';
      
      if (error.message.includes('403') || error.message.includes('forbidden') || error.message.includes('Forbidden')) {
        errorMessage = 'Access denied. The cluster may have been deleted or credentials revoked.';
      } else if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('NotFound')) {
        errorMessage = 'Cluster not found. It may have been deleted or renamed.';
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out. The cluster may be unreachable or not running.';
      } else if (error.message.includes('certificate') || error.message.includes('x509')) {
        errorMessage = 'Certificate error. The cluster TLS certificate may be invalid or expired.';
      } else if (error.message.includes('unauthorized') || error.message.includes('invalid token') || error.message.includes('401')) {
        errorMessage = 'Authorization failed. Your credentials may have expired or been revoked.';
      } else if (error.message.includes('LIVE DATA ONLY MODE')) {
        errorMessage = 'Cannot connect to cluster. The application is in LIVE DATA ONLY MODE. Please check your kubeconfig and ensure your cluster is accessible.';
      }
      
      setLiveStatusError(errorMessage);
      toast.error(errorMessage);
      setLiveClusterStatus(null); // Ensure no partial data is shown
    } finally {
      setIsLoadingLiveStatus(false);
    }
  };
  
  // Set up auto-refresh timer
  const setupAutoRefresh = (kubeconfig: string) => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }
    
    // Set new timer to refresh every 30 seconds
    autoRefreshTimerRef.current = setInterval(() => {
      if (autoRefreshEnabled) {
        fetchLiveStatus(kubeconfig);
      }
    }, 30000);
  };
  
  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);
    
    if (newState && cluster?.kubeconfig) {
      // If enabling, immediately start the refresh cycle
      setupAutoRefresh(cluster.kubeconfig);
    } else if (!newState && autoRefreshTimerRef.current) {
      // If disabling, clear the timer
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
  };
  
  // Calculate overall cluster health based on live status
  const getClusterHealth = () => {
    if (!liveClusterStatus) return { 
      status: 'Unknown', 
      color: 'bg-gray-500', 
      icon: <HelpCircle className="h-5 w-5 text-gray-500" /> 
    };
    
    const { healthStatus } = liveClusterStatus;
    
    switch (healthStatus) {
      case 'healthy':
        return { status: 'Healthy', color: 'bg-green-500', icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> };
      case 'degraded':
        return { status: 'Degraded', color: 'bg-amber-500', icon: <AlertCircle className="h-5 w-5 text-amber-500" /> };
      case 'critical':
        return { status: 'Critical', color: 'bg-red-500', icon: <AlertTriangle className="h-5 w-5 text-red-500" /> };
      default:
        return { status: 'Unknown', color: 'bg-gray-500', icon: <HelpCircle className="h-5 w-5 text-gray-500" /> };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getStatusBadge = (status: string, isUnreachable: boolean = false) => {
    const statusConfig = {
      running: { class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: <Check className="h-4 w-4 mr-1" /> },
      pending: { class: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: <Clock className="h-4 w-4 mr-1" /> },
      failed: { class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: <X className="h-4 w-4 mr-1" /> },
      unreachable: { class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300 border', icon: <AlertTriangle className="h-4 w-4 mr-1" /> }
    };
    
    // Force unreachable status badge when connection has failed, regardless of the database status
    const forceUnreachable = isUnreachable || connectionFailed;
    
    // Use unreachable config if explicitly marked as unreachable or connection failed
    const config = forceUnreachable ? 
      statusConfig.unreachable : 
      (statusConfig[status] || statusConfig.pending);
    
    return (
      <Badge variant="outline" className={`${config.class} px-2 py-1 flex items-center text-xs`}>
        {config.icon}
        <span className="capitalize">{forceUnreachable ? 'Unreachable' : status}</span>
      </Badge>
    );
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleDelete = async () => {
    if (!user || !cluster) return;
    
    if (window.confirm(`Are you sure you want to delete ${cluster.name}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        const success = await clusterService.deleteCluster(cluster.id);
        if (success) {
          toast.success(`Cluster "${cluster.name}" deleted successfully`);
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error deleting cluster:', error);
        toast.error(`Failed to delete cluster ${cluster.name}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRestart = async () => {
    if (!user || !cluster) return;
    
    setIsRestarting(true);
    try {
      // First, set status to pending
      await clusterService.updateCluster(cluster.id, { status: 'pending' });
      setCluster({ ...cluster, status: 'pending' });
      
      // Simulate restart process
      setTimeout(async () => {
        await clusterService.updateCluster(cluster.id, { status: 'running' });
        setCluster({ ...cluster, status: 'running' });
        toast.success(`Cluster "${cluster.name}" restarted successfully`);
        setIsRestarting(false);
      }, 3000);
    } catch (error) {
      console.error('Error restarting cluster:', error);
      toast.error(`Failed to restart cluster ${cluster.name}`);
      setIsRestarting(false);
    }
  };

  const handleDownloadConfig = () => {
    if (cluster?.kubeconfig) {
      const blob = new Blob([cluster.kubeconfig], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cluster.name}-kubeconfig.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Kubeconfig for "${cluster.name}" downloaded`);
    } else {
      toast.error(`No kubeconfig available for "${cluster.name}"`);
    }
  };

  // Enhanced migration function with direct migration capabilities
  const handleMigrate = async () => {
    // Option 1: Navigate to migration page with pre-filled source cluster
    if (!targetCluster) {
      navigate(`/migration?sourceCluster=${cluster.id}&mode=direct`);
      return;
    }
    
    // Option 2: Perform direct migration if target cluster is already selected
    setIsMigrationLoading(true);
    setMigrationStatus('in-progress');
    setMigrationProgress(0);
    setMigrationError(null);
    
    try {
      // Gather selected resources from all Kubernetes resource categories
      const selectedResources = Object.entries(selectedComponents)
        .filter(([_, selected]) => selected)
        .map(([key]) => {
          const [kind, name, namespace = 'default'] = key.split('|');
          return { kind, name, namespace };
        });
      
      if (selectedResources.length === 0) {
        toast.warning('No resources selected for migration. Please select resources first.');
        setIsMigrationLoading(false);
        return;
      }
      
      // Start the migration process
      const id = await MigrationService.migrateResources(
        cluster.kubeconfig,
        targetCluster.kubeconfig,
        selectedResources,
        migrationOptions
      );
      
      setMigrationId(id);
      toast.success(`Migration started with ID: ${id}`);
      
      // Poll for migration status
      const statusInterval = setInterval(async () => {
        try {
          const status = await MigrationService.getMigrationStatus(id);
          
          // Update progress
          if (status.resourcesTotal > 0) {
            const progressPercentage = Math.floor(
              (status.resourcesMigrated / status.resourcesTotal) * 100
            );
            setMigrationProgress(progressPercentage);
          }
          
          // Check if migration is completed or failed
          if (status.status === 'completed') {
            clearInterval(statusInterval);
            setMigrationStatus('completed');
            setIsMigrationLoading(false);
            toast.success(`Migration completed successfully! Migrated ${status.resourcesMigrated} resources.`);
          } else if (status.status === 'failed') {
            clearInterval(statusInterval);
            setMigrationStatus('failed');
            setMigrationError(status.error || 'Migration failed');
            setIsMigrationLoading(false);
            toast.error(`Migration failed: ${status.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error checking migration status:', error);
        }
      }, 2000);
      
      // Cleanup function for the interval
      return () => clearInterval(statusInterval);
    } catch (error: any) {
      setMigrationStatus('failed');
      setMigrationError(error.message || 'Failed to start migration');
      setIsMigrationLoading(false);
      toast.error(`Migration failed: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Helper function to toggle selection of a resource for migration
  const toggleResourceSelection = (kind: string, name: string, namespace: string) => {
    const key = `${kind}|${name}|${namespace}`;
    setSelectedComponents(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Helper function to select all resources of a particular kind
  const selectAllResourcesOfKind = (kind: string, selected: boolean) => {
    let resources: {name: string, namespace: string}[] = [];
    
    // Get the resources based on kind
    switch (kind) {
      case 'Pod':
        resources = pods.map(pod => ({ name: pod.name, namespace: pod.namespace }));
        break;
      case 'Deployment':
        resources = deployments.map(deployment => ({ name: deployment.name, namespace: deployment.namespace }));
        break;
      case 'Service':
        resources = services.map(service => ({ name: service.name, namespace: service.namespace }));
        break;
      case 'ConfigMap':
        resources = configMaps.map(configMap => ({ name: configMap.name, namespace: configMap.namespace }));
        break;
      case 'Secret':
        resources = secrets.map(secret => ({ name: secret.name, namespace: secret.namespace }));
        break;
      case 'PersistentVolumeClaim':
        resources = persistentVolumeClaims.map(pvc => ({ name: pvc.name, namespace: pvc.namespace }));
        break;
      // Add other resource kinds as needed
    }
    
    // Update selected components
    const newSelectedComponents = { ...selectedComponents };
    resources.forEach(resource => {
      const key = `${kind}|${resource.name}|${resource.namespace}`;
      newSelectedComponents[key] = selected;
    });
    
    setSelectedComponents(newSelectedComponents);
  };

  // Function to fetch pod YAML
  const fetchPodYaml = async (podName: string, namespace: string) => {
    if (!cluster?.kubeconfig) return;
    
    try {
      // Use the API utility to fetch pod YAML
      const data = await apiRequest(
        KUBERNETES_API.GET_POD_YAML,
        'POST',
        {
          kubeconfig: cluster.kubeconfig,
          podName,
          namespace
        }
      );
      
      return data.yaml;
    } catch (error) {
      console.error('Error fetching pod YAML:', error);
      toast.error('Failed to fetch pod configuration');
      return null;
    }
  };
  
  // Function to open pod details dialog
  const handlePodClick = async (pod: any) => {
    setSelectedPod(pod);
    setIsPodDetailsOpen(true);
    setIsEditing(false);
    
    // Fetch pod YAML
    const yaml = await fetchPodYaml(pod.name, pod.namespace);
    if (yaml) {
      setPodYaml(yaml);
      setEditedYaml(yaml);
    }
    
    // In a real app, you would fetch available tenants here
    // For now, we'll use mock data
    setAvailableTenants([
      { id: '1', name: 'Tenant A', type: 'tenant', status: 'running', nodes: 3, region: 'us-west-1', version: '1.24', created_at: new Date().toISOString(), owner_id: user?.id || '' },
      { id: '2', name: 'Tenant B', type: 'tenant', status: 'running', nodes: 2, region: 'us-east-1', version: '1.25', created_at: new Date().toISOString(), owner_id: user?.id || '' },
      { id: '3', name: 'Tenant C', type: 'tenant', status: 'running', nodes: 4, region: 'eu-west-1', version: '1.23', created_at: new Date().toISOString(), owner_id: user?.id || '' },
    ]);
    
    // Reset selected tenants
    setSelectedTenants({});
  };
  
  // Function to handle editing
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  // Function to save changes
  const handleSave = () => {
    setPodYaml(editedYaml);
    setIsEditing(false);
    toast.success('Configuration updated. Ready to deploy changes.');
  };
  
  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditedYaml(podYaml);
    setIsEditing(false);
  };
  
  // Function to open deploy dialog
  const handleDeploy = () => {
    setIsDeployDialogOpen(true);
  };
  
  // Function to handle tenant selection
  const handleTenantSelection = (tenantId: string, isSelected: boolean) => {
    setSelectedTenants(prev => ({
      ...prev,
      [tenantId]: isSelected
    }));
  };
  
  // Function to deploy changes
  const handleDeployChanges = () => {
    const tenantCount = Object.values(selectedTenants).filter(Boolean).length;
    
    if (tenantCount === 0) {
      // Deploy to current tenant only
      toast.success(`Changes deployed to ${cluster?.name}`);
    } else {
      // Deploy to selected tenants
      toast.success(`Changes deployed to ${tenantCount} tenant${tenantCount > 1 ? 's' : ''}`);
    }
    
    setIsDeployDialogOpen(false);
    setIsPodDetailsOpen(false);
    setSelectedPod(null);
  };

  const getKubeconfigContext = (kubeconfig: string) => {
    try {
      // Extract current context
      const currentContextMatch = kubeconfig.match(/current-context:\s+"?([\w-]+)"?/);
      const currentContext = currentContextMatch?.[1];
      
      // Extract namespace from contexts section if it exists
      let namespace = "";
      if (currentContext) {
        const namespaceMatch = kubeconfig.match(
          new RegExp(`context:\\s*\\n[\\s\\S]*?name:\\s*"?${currentContext}"?[\\s\\S]*?namespace:\\s*"?([\\w-]+)"?`)
        );
        namespace = namespaceMatch?.[1] || "";
      }
      
      // Create React fragments for each extracted piece of info
      return (
        <>
          {currentContext && (
            <div className="flex items-center">
              <dt className="w-36 font-medium">Current Context:</dt>
              <dd className="truncate font-mono">{currentContext}</dd>
            </div>
          )}
          {namespace && (
            <div className="flex items-center">
              <dt className="w-36 font-medium">Namespace:</dt>
              <dd className="truncate font-mono">{namespace}</dd>
            </div>
          )}
        </>
      );
    } catch (error) {
      console.error("Error parsing kubeconfig context:", error);
      return null;
    }
  };

  const getKubeconfigDetails = (kubeconfig: string) => {
    try {
      // Extract various pieces of information from kubeconfig
      const extractedInfo = [];
      
      // Extract server URL
      const serverMatch = kubeconfig.match(/server:\s+([^\n]+)/);
      if (serverMatch && serverMatch[1]) {
        extractedInfo.push(
          <div key="server" className="flex flex-col">
            <dt className="font-medium">API Server:</dt>
            <dd className="font-mono text-sm mt-1 break-all">{serverMatch[1]}</dd>
          </div>
        );
      }
      
      // Extract certificate authority info (without showing the actual data)
      const hasCertificateData = kubeconfig.includes("certificate-authority-data:");
      if (hasCertificateData) {
        extractedInfo.push(
          <div key="cert" className="flex flex-col">
            <dt className="font-medium">Certificate Authority:</dt>
            <dd className="text-sm mt-1">✓ Certificate data present (hidden for security)</dd>
          </div>
        );
      }
      
      // Extract cluster name
      const clusterNameMatch = kubeconfig.match(/clusters:[\s\S]*?- name:\s*"?([^"\n]+)"?/);
      if (clusterNameMatch && clusterNameMatch[1]) {
        extractedInfo.push(
          <div key="cluster-name" className="flex flex-col">
            <dt className="font-medium">Cluster Name:</dt>
            <dd className="font-mono text-sm mt-1">{clusterNameMatch[1]}</dd>
          </div>
        );
      }
      
      // Extract user name and authentication method
      const userNameMatch = kubeconfig.match(/users:[\s\S]*?- name:\s*"?([^"\n]+)"?/);
      if (userNameMatch && userNameMatch[1]) {
        extractedInfo.push(
          <div key="user" className="flex flex-col">
            <dt className="font-medium">User:</dt>
            <dd className="font-mono text-sm mt-1">{userNameMatch[1]}</dd>
          </div>
        );
      }
      
      // Check for auth methods
      const hasTokenAuth = kubeconfig.includes("token:");
      const hasExecAuth = kubeconfig.includes("exec:");
      const hasClientCert = kubeconfig.includes("client-certificate-data:");
      
      if (hasTokenAuth || hasExecAuth || hasClientCert) {
        extractedInfo.push(
          <div key="auth" className="flex flex-col">
            <dt className="font-medium">Authentication Method:</dt>
            <dd className="text-sm mt-1">
              {hasTokenAuth && <span className="block">✓ Token Authentication</span>}
              {hasExecAuth && <span className="block">✓ Exec Authentication (aws eks get-token)</span>}
              {hasClientCert && <span className="block">✓ Client Certificate Authentication</span>}
            </dd>
          </div>
        );
      }
      
      // Extract AWS profile if available
      const awsProfileMatch = kubeconfig.match(/AWS_PROFILE[\s\S]*?value:\s*"?([^"\n]+)"?/);
      if (awsProfileMatch && awsProfileMatch[1]) {
        extractedInfo.push(
          <div key="aws-profile" className="flex flex-col">
            <dt className="font-medium">AWS Profile:</dt>
            <dd className="font-mono text-sm mt-1">{awsProfileMatch[1]}</dd>
          </div>
        );
      }
      
      // Check if it has proxy settings
      const proxyUrlMatch = kubeconfig.match(/proxy-url:\s*([^\n]+)/);
      if (proxyUrlMatch && proxyUrlMatch[1]) {
        extractedInfo.push(
          <div key="proxy" className="flex flex-col">
            <dt className="font-medium">Proxy URL:</dt>
            <dd className="font-mono text-sm mt-1">{proxyUrlMatch[1]}</dd>
          </div>
        );
      }
      
      // Check for insecure-skip-tls-verify setting
      const insecureTlsMatch = kubeconfig.match(/insecure-skip-tls-verify:\s*([^\n]+)/);
      if (insecureTlsMatch && insecureTlsMatch[1] === "true") {
        extractedInfo.push(
          <div key="insecure-tls" className="flex flex-col">
            <dt className="font-medium text-amber-600">Security Warning:</dt>
            <dd className="text-sm mt-1 text-amber-600">
              TLS certificate verification is disabled (insecure-skip-tls-verify: true)
            </dd>
          </div>
        );
      }
      
      return extractedInfo.length > 0 ? 
        extractedInfo : 
        <p className="text-muted-foreground">No additional configuration details available</p>;
    } catch (error) {
      console.error("Error parsing kubeconfig details:", error);
      return <p className="text-muted-foreground">Error parsing kubeconfig details</p>;
    }
  };

  // Function to fetch kubeconfig details
  const fetchKubeConfigDetails = async (kubeconfig: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingKubeConfigDetails(true);
    
    try {
      const details = await apiRequest(
        KUBERNETES_API.GET_KUBECONFIG_DETAILS,
        'POST',
        { kubeconfig }
      );
      
      setKubeConfigDetails(details);
      console.log('Kubeconfig details:', details);
    } catch (error) {
      console.error('Error fetching kubeconfig details:', error);
      toast.error('Failed to fetch kubeconfig details');
    } finally {
      setIsLoadingKubeConfigDetails(false);
    }
  };
  
  // Function to fetch workloads (pods, deployments, replicasets, etc.)
  const fetchWorkloads = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig || !namespace) return;
    
    setIsLoadingWorkloads(true);
    
    // Fetch each workload type separately with individual error handling
    
    // Fetch pods
    try {
      const podsData = await apiRequest(KUBERNETES_API.GET_PODS, 'POST', { kubeconfig, namespace });
      if (podsData && podsData.items) setPods(podsData.items);
    } catch (error) {
      console.error('Error fetching pods:', error);
      // Continue with other workloads
    }
    
    // Fetch deployments
    try {
      const deploymentsData = await apiRequest(KUBERNETES_API.GET_DEPLOYMENTS, 'POST', { kubeconfig, namespace });
      if (deploymentsData && deploymentsData.items) setDeployments(deploymentsData.items);
    } catch (error) {
      console.error('Error fetching deployments:', error);
      // Continue with other workloads
    }
    
    // Fetch replica sets
    try {
      const replicaSetsData = await apiRequest(KUBERNETES_API.GET_REPLICASETS, 'POST', { kubeconfig, namespace });
      if (replicaSetsData && replicaSetsData.items) setReplicaSets(replicaSetsData.items);
    } catch (error) {
      console.error('Error fetching replica sets:', error);
      // Continue with other workloads
    }
    
    // Fetch stateful sets
    try {
      const statefulSetsData = await apiRequest(KUBERNETES_API.GET_STATEFULSETS, 'POST', { kubeconfig, namespace });
      if (statefulSetsData && statefulSetsData.items) setStatefulSets(statefulSetsData.items);
    } catch (error) {
      console.error('Error fetching stateful sets:', error);
      // Continue with other workloads
    }
    
    // Fetch daemon sets
    try {
      const daemonSetsData = await apiRequest(KUBERNETES_API.GET_DAEMONSETS, 'POST', { kubeconfig, namespace });
      if (daemonSetsData && daemonSetsData.items) setDaemonSets(daemonSetsData.items);
    } catch (error) {
      console.error('Error fetching daemon sets:', error);
      // Continue with other workloads
    }
    
    // Fetch jobs
    try {
      const jobsData = await apiRequest(KUBERNETES_API.GET_JOBS, 'POST', { kubeconfig, namespace });
      if (jobsData && jobsData.items) setJobs(jobsData.items);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      // Continue with other workloads
    }
    
    // Fetch cron jobs
    try {
      const cronJobsData = await apiRequest(KUBERNETES_API.GET_CRONJOBS, 'POST', { kubeconfig, namespace });
      if (cronJobsData && cronJobsData.items) setCronJobs(cronJobsData.items);
    } catch (error) {
      console.error('Error fetching cron jobs:', error);
      // Continue with other workloads
    }
    
    setIsLoadingWorkloads(false);
  };

  // Function to fetch networking resources (services, ingresses)
  const fetchNetworking = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig || !namespace) return;
    
    setIsLoadingNetworking(true);
    
    // Fetch services
    try {
      const servicesData = await apiRequest(
        KUBERNETES_API.GET_SERVICES,
        'POST',
        { kubeconfig, namespace }
      );
      if (servicesData && servicesData.items) {
        setServices(servicesData.items);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      // Continue with other resources
    }

    // Fetch ingresses
    try {
      const ingressesData = await apiRequest(
        KUBERNETES_API.GET_INGRESSES,
        'POST',
        { kubeconfig, namespace }
      );
      if (ingressesData && ingressesData.items) {
        setIngresses(ingressesData.items);
      }
    } catch (error) {
      console.error('Error fetching ingresses:', error);
      // Continue with other resources
    }
    
    setIsLoadingNetworking(false);
  };

  // Function to fetch configuration resources (configmaps, secrets, etc.)
  const fetchConfigurations = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingConfigurations(true);
    // Clear previous state
    setConfigMaps([]);
    setSecrets([]);
    setResourceQuotas([]);
    setLimitRanges([]);

    // Fetch configmaps
    try {
      const configMapsData = await apiRequest(
        KUBERNETES_API.GET_CONFIGMAPS,
        'POST',
        { kubeconfig, namespace }
      );
      
      if (configMapsData && configMapsData.items) {
        const configMapsList = configMapsData.items.map((cm: any) => ({
          name: cm.metadata.name,
          namespace: cm.metadata.namespace,
          data: cm.data,
          dataCount: cm.data ? Object.keys(cm.data).length : 0, 
          age: formatDate(cm.metadata.creationTimestamp)
        }));
        setConfigMaps(configMapsList);
      }
    } catch (error) {
      console.error('Error fetching configmaps:', error);
      // Continue with other configurations
    }
    
    // Fetch secrets
    try {
      const secretsData = await apiRequest(
        KUBERNETES_API.GET_SECRETS,
        'POST',
        { kubeconfig, namespace }
      );
      
      if (secretsData && secretsData.items) {
        const secretsList = secretsData.items.map((secret: any) => ({
          name: secret.metadata.name,
          namespace: secret.metadata.namespace,
          type: secret.type,
          dataCount: secret.data ? Object.keys(secret.data).length : 0, 
          age: formatDate(secret.metadata.creationTimestamp)
        }));
        setSecrets(secretsList);
      }
    } catch (error) {
      console.error('Error fetching secrets:', error);
      // Continue with other configurations
    }
    
    // Fetch resource quotas
    try {
      const resourceQuotasData = await apiRequest(
        KUBERNETES_API.GET_RESOURCE_QUOTAS,
        'POST',
        { kubeconfig, namespace }
      );
      
      if (resourceQuotasData && resourceQuotasData.items) {
        const resourceQuotasList = resourceQuotasData.items.map((quota: any) => ({
          name: quota.metadata.name,
          namespace: quota.metadata.namespace,
          resources: Object.entries(quota.status?.hard || {}).map(([resource, hardLimit]) => ({
             resource,
             used: quota.status?.used?.[resource] || '0',
             hard: hardLimit
           })),
          age: formatDate(quota.metadata.creationTimestamp)
        }));
        setResourceQuotas(resourceQuotasList);
      }
    } catch (error) {
      console.error('Error fetching resource quotas:', error);
      // Continue with other configurations
    }

    // Fetch limit ranges
    try {
      const limitRangesData = await apiRequest(
        KUBERNETES_API.GET_LIMIT_RANGES, 
        'POST',
        { kubeconfig, namespace }
      );

      if (limitRangesData && limitRangesData.items) {
        const limitRangesList = limitRangesData.items.map((limit: any) => ({
          name: limit.metadata.name,
          namespace: limit.metadata.namespace,
          limits: limit.spec?.limits?.map((item: any) => ({
            type: item.type,
            resource: Object.keys(item.min || item.max || item.default || item.defaultRequest || {})[0] || 'N/A',
            min: item.min ? Object.values(item.min)[0] : '-',
            max: item.max ? Object.values(item.max)[0] : '-',
            default: item.default ? Object.values(item.default)[0] : '-',
            defaultRequest: item.defaultRequest ? Object.values(item.defaultRequest)[0] : '-',
          })) || [],
          age: formatDate(limit.metadata.creationTimestamp)
        }));
        setLimitRanges(limitRangesList);
      }
    } catch (error) {
      console.error('Error fetching limit ranges:', error);
      // Continue with other configurations
    }
    
    setIsLoadingConfigurations(false);
  };

  // Function to fetch storage resources (PVs, PVCs, StorageClasses)
  const fetchStorage = async (kubeconfig: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingStorage(true);
    // Clear previous state
    setPersistentVolumes([]);
    setPersistentVolumeClaims([]);
    setStorageClasses([]);

    try {
      // Fetch persistent volumes 
      try {
        const persistentVolumesData = await apiRequest(
          KUBERNETES_API.GET_PERSISTENT_VOLUMES,
          'POST',
          { kubeconfig }
        );
        
        if (persistentVolumesData && persistentVolumesData.items) {
          const pvList = persistentVolumesData.items.map((pv: any) => ({
            name: pv.metadata.name,
            capacity: pv.spec.capacity?.storage,
            accessModes: pv.spec.accessModes,
            reclaimPolicy: pv.spec.persistentVolumeReclaimPolicy,
            status: pv.status.phase,
            claim: pv.spec.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : '-',
            storageClass: pv.spec.storageClassName || '-',
            age: formatDate(pv.metadata.creationTimestamp)
          }));
          setPersistentVolumes(pvList);
        }
      } catch (pvError) {
        console.error('Error fetching persistent volumes:', pvError);
      }
      
      // Fetch persistent volume claims
      try {
        const persistentVolumeClaimsData = await apiRequest(
          KUBERNETES_API.GET_PERSISTENT_VOLUME_CLAIMS,
          'POST',
          { kubeconfig } 
        );
        
        if (persistentVolumeClaimsData && persistentVolumeClaimsData.items) {
          const pvcList = persistentVolumeClaimsData.items.map((pvc: any) => ({
            name: pvc.metadata.name,
            namespace: pvc.metadata.namespace,
            status: pvc.status.phase,
            volumeName: pvc.spec.volumeName || '-',
            capacity: pvc.status.capacity?.storage,
            accessModes: pvc.spec.accessModes,
            storageClass: pvc.spec.storageClassName || '-',
            age: formatDate(pvc.metadata.creationTimestamp)
          }));
          setPersistentVolumeClaims(pvcList);
        }
      } catch (pvcError) {
        console.error('Error fetching persistent volume claims:', pvcError);
      }
      
      // Fetch storage classes
      try {
        const storageClassesData = await apiRequest(
          KUBERNETES_API.GET_STORAGE_CLASSES,
          'POST',
          { kubeconfig }
        );
        
        if (storageClassesData && storageClassesData.items) {
          const scList = storageClassesData.items.map((sc: any) => ({
            name: sc.metadata.name,
            provisioner: sc.provisioner,
            reclaimPolicy: sc.reclaimPolicy || 'Delete',
            volumeBindingMode: sc.volumeBindingMode || 'Immediate',
            allowVolumeExpansion: sc.allowVolumeExpansion || false,
            isDefault: sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
            age: formatDate(sc.metadata.creationTimestamp)
          }));
          setStorageClasses(scList);
        }
      } catch (scError) {
        console.error('Error fetching storage classes:', scError);
      }
    } catch (error) {
      console.error('Error fetching storage resources:', error);
      toast.error('Failed to fetch storage resources');
    } finally {
      setIsLoadingStorage(false);
    }
  };
  
  // Function to fetch all resources for a namespace
  const fetchResourcesForNamespace = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig || !namespace) {
      console.error("Cannot fetch resources: missing kubeconfig or namespace");
      return;
    }
    
    console.log(`Fetching all resources for namespace: ${namespace}`);
    
    // Fetch all resource types for this namespace, handling each separately
    
    // Fetch workloads (pods, deployments, etc.)
    try {
      await fetchWorkloads(kubeconfig, namespace);
    } catch (error) {
      console.error(`Error fetching workloads for namespace ${namespace}:`, error);
      // Continue with other resources
    }
    
    // Fetch networking resources (services, ingresses)
    try {
      await fetchNetworking(kubeconfig, namespace);
    } catch (error) {
      console.error(`Error fetching networking resources for namespace ${namespace}:`, error);
      // Continue with other resources
    }
    
    // Fetch configuration resources (configmaps, secrets, etc.)
    try {
      await fetchConfigurations(kubeconfig, namespace);
    } catch (error) {
      console.error(`Error fetching configuration resources for namespace ${namespace}:`, error);
      // Continue with other resources
    }
    
    // Storage resources might be cluster-wide, but some like PVCs are namespace-scoped
    try {
      await fetchStorage(kubeconfig);
    } catch (error) {
      console.error(`Error fetching storage resources:`, error);
      // Continue with other resources
    }
    
    // Fetch specific services for this namespace
    try {
      await fetchServices(kubeconfig, namespace);
    } catch (error) {
      console.error(`Error fetching services for namespace ${namespace}:`, error);
      // Continue with other resources
    }
    
    console.log(`Completed resource fetching for namespace: ${namespace}`);
  };
  
  // Function to fetch nodes
  const fetchNodes = async (kubeconfig: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingNodes(true);
    console.log("Attempting to fetch nodes with POST request...");
    
    try {
      console.log("Calling nodes API endpoint:", KUBERNETES_API.GET_NODES);
      
      const nodesData = await apiRequest(
        KUBERNETES_API.GET_NODES,
        'POST',
        { kubeconfig }
      );
      
      console.log("Nodes API response:", nodesData);

      if (nodesData && nodesData.items) {
        const nodesList = nodesData.items.map((node: any) => ({
          name: node.metadata.name,
          status: node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
          creationTimestamp: node.metadata.creationTimestamp,
          kubeletVersion: node.status?.nodeInfo?.kubeletVersion,
          osImage: node.status?.nodeInfo?.osImage,
          addresses: node.status?.addresses,
          roles: node.metadata.labels ? 
            Object.keys(node.metadata.labels)
              .filter(key => key.startsWith('node-role.kubernetes.io/'))
              .map(key => key.replace('node-role.kubernetes.io/', ''))
            : []
        }));
        
        console.log("Processed nodes data:", nodesList);
        setNodes(nodesList);
      } else {
        console.error("API returned a response but no node items were found:", nodesData);
        setNodes([]);
      }
    } catch (error) {
      console.error('Error fetching nodes:', error);
      toast.error('Failed to fetch nodes: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setNodes([]);
    } finally {
      setIsLoadingNodes(false);
    }
  };

  // Fetch services for a specific namespace
  const fetchServices = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig || !namespace) return;
    
    setIsLoadingServices(true);
    
    try {
      console.log(`Fetching services for namespace ${namespace}`);
      const servicesData = await apiRequest(
        KUBERNETES_API.GET_SERVICES,
        'POST', // Revert to POST
        { kubeconfig, namespace }
      );
      
      console.log('Services data received:', servicesData);
      
      if (servicesData && servicesData.items) {
        // Transform the raw service data to ensure consistent structure
        const transformedServices = servicesData.items.map((service: any) => {
          // Extract service ports from spec.ports if available
          const ports = service.spec?.ports ? 
            service.spec.ports.map((port: any) => ({
              port: port.port || 0,
              protocol: port.protocol || 'TCP',
              nodePort: port.nodePort || null,
            })) : [];
          
          return {
            name: service.metadata?.name || 'Unknown',
            namespace: service.metadata?.namespace || namespace,
            type: service.spec?.type || 'ClusterIP',
            clusterIP: service.spec?.clusterIP || 'None',
            externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip || 
                       service.status?.loadBalancer?.ingress?.[0]?.hostname || null,
            ports: ports,
            age: service.metadata?.creationTimestamp ?
              formatDate(service.metadata.creationTimestamp) : 'Unknown'
          };
        });
        
        console.log('Transformed services:', transformedServices);
        setServices(transformedServices);
      } else {
        console.warn('No services found or empty response received');
        setServices([]);
      }
    } catch (error) {
      console.error('Error fetching services for namespace ', namespace, ':', error);
      toast.error('Failed to fetch services for namespace: ' + namespace);
      setServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  };
  
  // Handle namespace change
  const handleNamespaceChange = (namespace: string) => {
    console.log(`Changing namespace to: ${namespace}`);
    setSelectedNamespace(namespace);
    
    if (namespace && cluster?.kubeconfig) {
      // Fetch resources for this namespace
      fetchResourcesForNamespace(cluster.kubeconfig, namespace);
    } else {
      console.warn(`Cannot fetch resources: ${namespace ? 'No kubeconfig available' : 'No namespace selected'}`);
    }
  };

  // Function for manual refresh
  const handleManualRefresh = async () => {
    if (cluster?.kubeconfig) {
      try {
        const status = await fetchClusterStatus(cluster.kubeconfig);
        setLiveClusterStatus(status);
        setLastUpdated(new Date().toLocaleTimeString());
        setLiveStatusError('');
        setConsecutiveFailures(0); // Reset failure counter on success
        setConnectionFailed(false); // Reset connection failed flag
        
        // If the cluster was previously marked as failed but is now accessible,
        // update its status back to running
        if (cluster.status === 'failed') {
          try {
            await clusterService.updateCluster(cluster.id, { status: 'running' });
            setCluster({...cluster, status: 'running'});
            toast.success(`Cluster "${cluster.name}" is now accessible and marked as running`);
          } catch (updateError) {
            console.error('Error updating cluster status:', updateError);
          }
        }
        
        toast.success('Status refreshed');
      } catch (error: any) {
        console.error('Error refreshing live status:', error);
        
        // Increment consecutive failures
        const newFailureCount = consecutiveFailures + 1;
        setConsecutiveFailures(newFailureCount);
        setConnectionFailed(true); // Set connection failed flag
        
        // Always update local UI immediately on manual refresh error
        if (cluster && cluster.status !== 'failed') {
          setCluster({...cluster, status: 'failed' as "running" | "pending" | "failed"});
        }
        
        // Update cluster status to failed on manual refresh failure
        if ((newFailureCount >= MAX_FAILURES_BEFORE_STATUS_UPDATE || cluster.status === 'running') 
            && cluster.status !== 'failed') {
          try {
            await clusterService.updateCluster(cluster.id, { status: 'failed' });
            toast.error(`Cluster "${cluster.name}" marked as failed due to connection issues`);
          } catch (updateError) {
            console.error('Error updating cluster status:', updateError);
          }
        }
        
        setLiveStatusError(error.message || 'Failed to refresh live status');
        setLiveClusterStatus(null);
        toast.error('Failed to refresh status');
      }
    }
  };

  const getTypeBadge = (type: string) => {
    const isMultiTenant = type === 'tenant';
    const className = isMultiTenant 
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    
    return (
      <Badge variant="outline" className={`${className} px-2 py-1 flex items-center text-xs`}>
        {isMultiTenant ? (
          <Globe className="h-4 w-4 mr-1" />
        ) : (
          <Server className="h-4 w-4 mr-1" />
        )}
        {isMultiTenant ? 'Multi-Tenant' : 'Single Tenant'}
      </Badge>
    );
  };

  const handleMigrateToMultiTenant = () => {
    navigate(`/migration?cluster=${cluster?.id}`);
  };

  // Function to fetch monitoring data (metrics, logs)
  const fetchMonitoring = async (kubeconfig: string) => {
    if (!kubeconfig) return;

    setIsLoadingMonitoring(true);
    // Clear previous state
    setMetrics(null); 
    setLogs([]); 

    try {
      // Fetch metrics
      try {
        const metricsData = await apiRequest(
          KUBERNETES_API.GET_METRICS, 
          'POST',
          { kubeconfig } 
        );
        if (metricsData) {
          const transformedMetrics = {
            cpu: { 
              used: metricsData.cpuUsage?.used || 0, 
              total: metricsData.cpuUsage?.total || 0, 
              percentUsed: metricsData.cpuUsage?.percent || 0 
            },
            memory: { 
              used: metricsData.memoryUsage?.used || '0Gi', 
              total: metricsData.memoryUsage?.total || '0Gi', 
              percentUsed: metricsData.memoryUsage?.percent || 0 
            },
            pods: { 
              used: metricsData.podUsage?.used || 0, 
              total: metricsData.podUsage?.total || 0, 
              percentUsed: metricsData.podUsage?.percent || 0 
            }
          };
          setMetrics(transformedMetrics);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }

      // Fetch logs
      try {
        const logsData = await apiRequest(
          KUBERNETES_API.GET_LOGS, 
          'POST',
          { kubeconfig } 
        );
        if (logsData && logsData.items) {
          setLogs(logsData.items); 
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    } catch (error) {
      console.error('Error in fetchMonitoring:', error);
      toast.error('Failed to fetch monitoring data');
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  // Function to count selected components by type
  const updateComponentCounts = () => {
    const counts: {[key: string]: number} = {};
    
    // Count selected components by their kind
    Object.entries(selectedComponents).forEach(([key, selected]) => {
      if (selected) {
        const [kind] = key.split('|');
        counts[kind] = (counts[kind] || 0) + 1;
      }
    });
    
    setComponentCounts(counts);
  };
  
  // Helper function to toggle component selection
  const toggleComponentSelection = (kind: string, namespace: string, name: string) => {
    const componentKey = `${kind}|${namespace}|${name}`;
    const newSelectedComponents = { ...selectedComponents };
    
    newSelectedComponents[componentKey] = !newSelectedComponents[componentKey];
    setSelectedComponents(newSelectedComponents);
    
    // Update component counts
    updateComponentCounts();
  };
  
  // Function to handle direct migration from the UI
  const handleDirectMigrate = async () => {
    if (!targetCluster) {
      toast.error('Please select a target cluster');
      return;
    }
    
    const selectedResources = Object.entries(selectedComponents)
      .filter(([_, selected]) => selected)
      .map(([key]) => {
        // Format: kind|namespace|name
        const parts = key.split('|');
        return {
          kind: parts[0],
          namespace: parts[1],
          name: parts[2]
        };
      });
    
    if (selectedResources.length === 0) {
      toast.error('Please select at least one resource to migrate');
      return;
    }
    
    setIsMigrationLoading(true);
    setMigrationStatus('in-progress');
    setMigrationProgress(0);
    setMigrationError(null);
    
    try {
      // Start the migration process using MigrationService
      const id = await MigrationService.migrateResources(
        cluster.kubeconfig,
        targetCluster.kubeconfig,
        selectedResources,
        migrationOptions
      );
      
      setMigrationId(id);
      toast.success(`Migration started with ID: ${id}`);
      
      // Poll for migration status
      const statusInterval = setInterval(async () => {
        try {
          const status = await MigrationService.getMigrationStatus(id);
          
          // Update progress
          if (status.resourcesTotal > 0) {
            const progressPercentage = Math.floor(
              (status.resourcesMigrated / status.resourcesTotal) * 100
            );
            setMigrationProgress(progressPercentage);
          }
          
          // Check if migration is completed or failed
          if (status.status === 'completed') {
            clearInterval(statusInterval);
            setMigrationStatus('completed');
            setIsMigrationLoading(false);
            toast.success(`Migration completed successfully! Migrated ${status.resourcesMigrated} resources.`);
          } else if (status.status === 'failed') {
            clearInterval(statusInterval);
            setMigrationStatus('failed');
            setMigrationError(status.error || 'Migration failed');
            setIsMigrationLoading(false);
            toast.error(`Migration failed: ${status.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error checking migration status:', error);
        }
      }, 2000);
      
      return () => clearInterval(statusInterval);
    } catch (error: any) {
      setMigrationStatus('failed');
      setMigrationError(error.message || 'Failed to start migration');
      setIsMigrationLoading(false);
      toast.error(`Migration failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Function to generate YAML for selected components
  const handleGenerateYaml = async () => {
    if (Object.keys(selectedComponents).filter(key => selectedComponents[key]).length === 0) {
      toast.error('No components selected for migration');
      return;
    }

    setIsMigrationLoading(true);
    
    try {
      // Get selected components
      const selectedItems: ResourceToMigrate[] = Object.keys(selectedComponents)
        .filter(key => selectedComponents[key])
        .map(key => {
          const [kind, namespace, name] = key.split('|');
          return { kind, namespace, name };
        });
      
      // Generate YAML
      const yaml = await MigrationService.generateYaml(
        cluster.kubeconfig,
        selectedItems
      );
      
      // Create a downloadable blob
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration-${new Date().toISOString().slice(0, 10)}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success('YAML generated and downloaded');
      
    } catch (error) {
      console.error('Error generating migration YAML:', error);
      toast.error('Failed to generate migration YAML');
    } finally {
      setIsMigrationLoading(false);
    }
  };
  
  // Fetch available target clusters for direct migration
  useEffect(() => {
    const fetchTargetClusters = async () => {
      if (!user || !cluster) return;
      
      setIsLoadingTargetClusters(true);
      
      try {
        // Fetch clusters suitable as migration targets (multi-tenant clusters)
        const clusters = await clusterService.getAllClusters(user.id);
        // Filter for multi-tenant clusters or other valid targets that aren't the current cluster
        const validTargets = clusters.filter(c => 
          c.type === 'tenant' && c.id !== cluster?.id
        );
        
        setAvailableTargetClusters(validTargets);
        // Pre-select the first valid target if available and none currently selected
        if (validTargets.length > 0 && !targetCluster) {
          setTargetCluster(validTargets[0]);
        }
      } catch (error) {
        console.error('Error fetching target clusters:', error);
        toast.error('Failed to load target clusters');
      } finally {
        setIsLoadingTargetClusters(false);
      }
    };
    
    // Only fetch target clusters when on the migration tab
    if (activeTab === 'migration') {
      fetchTargetClusters();
    }
  }, [user, cluster, activeTab, targetCluster]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <Button 
            variant="ghost" 
            className="mb-6 hover:bg-transparent" 
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          
          {/* Display connection error banner at top */}
          {connectionFailed && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Connection Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">
                    {liveStatusError || 'Failed to connect to cluster. The cluster is unreachable or may have been deleted.'}
                  </p>
                  <div className="mt-3 flex space-x-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleManualRefresh} 
                      className="border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Connection
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4 mx-auto" />
              <p className="text-lg">Loading cluster details...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertTriangle className="h-10 w-10 text-red-500 mb-4 mx-auto" />
              <p className="text-lg font-medium text-red-500 mb-2">{error}</p>
              <Button variant="outline" onClick={handleBack}>Return to Dashboard</Button>
            </div>
          ) : cluster ? (
            <>
              <div className={`bg-white dark:bg-gray-800 rounded-lg border ${connectionFailed || cluster.status === 'failed' ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} shadow-subtle overflow-hidden`}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center">
                      <Server className="h-6 w-6 text-primary mr-3" />
                      <h1 className="text-2xl font-bold">{cluster.name}</h1>
                      <div className="ml-4">{getStatusBadge(cluster.status, cluster.status === 'failed' || connectionFailed)}</div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center mr-2">
                        <button 
                          onClick={toggleAutoRefresh}
                          className={`flex items-center px-3 py-1 rounded text-xs font-medium ${
                            autoRefreshEnabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {autoRefreshEnabled ? 'Auto-refresh On' : 'Auto-refresh Off'}
                        </button>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleDownloadConfig}
                      >
                        <DownloadCloud className="h-4 w-4 mr-2" /> Download Config
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleManualRefresh}
                        disabled={isLoadingLiveStatus}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLiveStatus ? 'animate-spin' : ''}`} /> 
                        Refresh
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleRestart}
                        disabled={isRestarting || cluster.status === 'pending'}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRestarting ? 'animate-spin' : ''}`} /> 
                        {isRestarting ? 'Restarting...' : 'Restart'}
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> 
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                  
                  {lastUpdated && (
                    <div className="mt-4 text-xs text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {lastUpdated}
                      {isLoadingLiveStatus && (
                        <span className="ml-2 flex items-center">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Refreshing...
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h2 className="text-xl font-medium mb-4">Cluster Information</h2>
                      
                      <dl className="grid grid-cols-1 gap-4">
                        <div className="flex items-start">
                          <dt className="w-32 font-medium flex items-center">
                            <Server className="h-4 w-4 mr-2 opacity-70" /> Type:
                          </dt>
                          <dd>
                            {getTypeBadge(cluster.type)}
                          </dd>
                        </div>
                        
                        <div className="flex items-center">
                          <dt className="w-32 font-medium flex items-center">
                            <Cpu className="h-4 w-4 mr-2 opacity-70" /> Nodes:
                          </dt>
                          <dd>{cluster.nodes}</dd>
                        </div>
                        
                        <div className="flex items-center">
                          <dt className="w-32 font-medium flex items-center">
                            <Globe className="h-4 w-4 mr-2 opacity-70" /> Region:
                          </dt>
                          <dd>{cluster.region}</dd>
                        </div>
                        
                        <div className="flex items-center">
                          <dt className="w-32 font-medium flex items-center">
                            <Calendar className="h-4 w-4 mr-2 opacity-70" /> Created:
                          </dt>
                          <dd>{formatDate(cluster.created_at)}</dd>
                        </div>
                        
                        <div className="flex items-center">
                          <dt className="w-32 font-medium flex items-center">
                            <Server className="h-4 w-4 mr-2 opacity-70" /> Version:
                          </dt>
                          <dd>v{cluster.version}</dd>
                        </div>
                        
                        {liveClusterStatus && (
                          <div className="flex items-center">
                            <dt className="w-32 font-medium flex items-center">
                              <Activity className="h-4 w-4 mr-2 opacity-70" /> Status:
                            </dt>
                            <dd className="flex items-center">
                              {getClusterHealth().icon}
                              <span className="ml-1">{getClusterHealth().status}</span>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-medium mb-4">Provider Configuration</h2>
                      
                      {(cluster.aws_account_id || cluster.eks_cluster_name || cluster.kubeconfig) && (
                        <dl className="grid grid-cols-1 gap-4">
                          {cluster.eks_cluster_name && (
                            <div className="flex items-center">
                              <dt className="w-36 font-medium">EKS Cluster Name:</dt>
                              <dd className="truncate font-mono">{cluster.eks_cluster_name}</dd>
                            </div>
                          )}
                          
                          {cluster.aws_account_id && (
                            <div className="flex items-center">
                              <dt className="w-36 font-medium">AWS Account ID:</dt>
                              <dd className="truncate font-mono">{cluster.aws_account_id}</dd>
                            </div>
                          )}
                          
                          {cluster.aws_role_arn && (
                            <div className="flex items-center">
                              <dt className="w-36 font-medium">AWS Role ARN:</dt>
                              <dd className="truncate font-mono">{cluster.aws_role_arn}</dd>
                            </div>
                          )}
                          
                          {cluster.kubeconfig && getKubeconfigContext(cluster.kubeconfig)}
                        </dl>
                      )}
                      
                      {!cluster.aws_account_id && !cluster.eks_cluster_name && !cluster.kubeconfig && (
                        <p className="text-muted-foreground">No provider configuration available</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Live Status Section */}
                  {cluster.kubeconfig && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Live Cluster Status</h2>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            Last updated: {lastUpdated || 'Never'}
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={toggleAutoRefresh}
                          >
                            {autoRefreshEnabled ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={handleManualRefresh}
                          >
                            Refresh Now
                          </Button>
                        </div>
                      </div>

                      {isLoadingLiveStatus ? (
                        <div className="flex justify-center items-center p-10">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                          <span className="ml-3">Connecting to cluster...</span>
                        </div>
                      ) : liveClusterStatus ? (
                        <div>
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-md">
                              <h3 className="font-medium text-lg">Nodes</h3>
                              <div className="mt-2">
                                <div className="text-3xl font-bold">{liveClusterStatus.nodes.length}</div>
                                <div className="text-sm text-gray-600">
                                  {liveClusterStatus.nodes.filter((node: any) => node.status === 'Ready').length} Ready / 
                                  {liveClusterStatus.nodes.filter((node: any) => node.status !== 'Ready').length} Not Ready
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-md">
                              <h3 className="font-medium text-lg">Pods</h3>
                              <div className="mt-2">
                                <div className="text-3xl font-bold">{liveClusterStatus.pods.length}</div>
                                <div className="text-sm text-gray-600">
                                  {liveClusterStatus.pods.filter((pod: any) => pod.status === 'Running').length} Running / 
                                  {liveClusterStatus.pods.filter((pod: any) => pod.status !== 'Running').length} Other
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-md">
                              <h3 className="font-medium text-lg">Cluster Health</h3>
                              <div className="mt-2">
                                <div className="text-xl font-bold">{liveClusterStatus.nodes.every((node: any) => node.status === 'Ready') ? 'Healthy' : 'Issues Detected'}</div>
                                <div className="text-sm text-gray-600">
                                  Kubernetes v{liveClusterStatus.kubernetesVersion}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Tabs defaultValue="namespaces" value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="flex overflow-x-auto py-2 space-x-1 bg-slate-100 dark:bg-slate-900 rounded-md p-1">
                              <TabsTrigger value="namespaces" className="font-medium">Namespaces</TabsTrigger>
                              <TabsTrigger value="nodes" className="font-medium">Nodes</TabsTrigger>
                              <TabsTrigger value="workloads" className="font-medium">Workloads</TabsTrigger>
                              <TabsTrigger value="networking" className="font-medium">Networking</TabsTrigger>
                              <TabsTrigger value="configurations" className="font-medium">Configurations</TabsTrigger>
                              <TabsTrigger value="storage" className="font-medium">Storage</TabsTrigger>
                              <TabsTrigger value="clusterinfo" className="font-medium">Cluster Info</TabsTrigger>
                              <TabsTrigger value="monitoring" className="font-medium">Monitoring</TabsTrigger>
                              <TabsTrigger value="migration" className="font-medium">Migration</TabsTrigger>
                              {cluster?.type === 'tenant' && (
                                <TabsTrigger value="tenant" className="font-medium">Tenant</TabsTrigger>
                              )}
                            </TabsList>
                            
                            <TabsContent value="nodes">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memory</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {liveClusterStatus.nodes.map((node: any) => (
                                      <tr key={node.name}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{node.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                          <Badge className={node.status === 'Ready' ? 'bg-green-500' : 'bg-red-500'}>
                                            {node.status}
                                          </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {node.roles.length > 0 ? node.roles.join(', ') : 'worker'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{node.version}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          <div className="flex flex-col">
                                            <div className="flex justify-between mb-1 text-xs">
                                              <span>{node.cpu.percent}%</span>
                                              <span>{node.cpu.usage} / {node.cpu.capacity}</span>
                                            </div>
                                            <Progress value={node.cpu.percent} 
                                              className="h-2 w-full bg-gray-200" 
                                              indicatorClassName={`${node.cpu.percent > 80 ? 'bg-red-500' : node.cpu.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                            />
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          <div className="flex flex-col">
                                            <div className="flex justify-between mb-1 text-xs">
                                              <span>{node.memory.percent}%</span>
                                              <span>{node.memory.usage} / {node.memory.capacity}</span>
                                            </div>
                                            <Progress value={node.memory.percent} 
                                              className="h-2 w-full bg-gray-200" 
                                              indicatorClassName={`${node.memory.percent > 80 ? 'bg-red-500' : node.memory.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="workloads" className="pt-4">
                              <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-100 dark:border-blue-900/40">
                                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center mb-1">
                                  <Server className="h-4 w-4 mr-2" /> Workloads
                                </h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400">Manage your application workloads like Pods, Deployments, StatefulSets and more.</p>
                              </div>
                              <Tabs value={workloadsTab} onValueChange={setWorkloadsTab}>
                                <TabsList className="flex overflow-x-auto py-1 mb-4 space-x-1 bg-blue-50 dark:bg-blue-950/30 rounded-md p-1 border border-blue-100 dark:border-blue-900">
                                  <TabsTrigger value="pods" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Pods</TabsTrigger>
                                  <TabsTrigger value="deployments" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Deployments</TabsTrigger>
                                  <TabsTrigger value="replicasets" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">ReplicaSets</TabsTrigger>
                                  <TabsTrigger value="statefulsets" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">StatefulSets</TabsTrigger>
                                  <TabsTrigger value="daemonsets" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">DaemonSets</TabsTrigger>
                                  <TabsTrigger value="jobs" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Jobs</TabsTrigger>
                                  <TabsTrigger value="cronjobs" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">CronJobs</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="pods">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restarts</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {liveClusterStatus.pods.map((pod: any) => (
                                          <tr 
                                            key={`${pod.namespace}-${pod.name}`}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handlePodClick(pod)}
                                          >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pod.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pod.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                              <Badge className={
                                                pod.status === 'Running' ? 'bg-green-500' : 
                                                pod.status === 'Pending' ? 'bg-yellow-500' : 
                                                pod.status === 'Succeeded' ? 'bg-blue-500' : 'bg-red-500'
                                              }>
                                                {pod.status}
                                              </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {pod.restarts > 0 ? (
                                                <span className="text-red-500 font-medium">{pod.restarts}</span>
                                              ) : pod.restarts}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pod.node}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pod.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="deployments">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replicas</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {deployments.map((deployment: any) => (
                                          <tr key={`${deployment.namespace}-${deployment.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{deployment.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deployment.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.replicas.current}/{deployment.replicas.desired}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.replicas.available}/{deployment.replicas.desired}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deployment.strategy}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deployment.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="replicasets">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desired</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {replicaSets.map((rs: any) => (
                                          <tr key={`${rs.namespace}-${rs.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rs.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rs.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rs.replicas.desired}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rs.replicas.current}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rs.ownerReference || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rs.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="statefulsets">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replicas</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Strategy</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {statefulSets.map((sts: any) => (
                                          <tr key={`${sts.namespace}-${sts.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sts.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {sts.replicas.current}/{sts.replicas.desired}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.serviceName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.updateStrategy}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="daemonsets">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desired</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ready</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Strategy</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {daemonSets.map((ds: any) => (
                                          <tr key={`${ds.namespace}-${ds.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ds.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.desiredNumberScheduled}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.currentNumberScheduled}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.numberReady}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.updateStrategy}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="jobs">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Succeeded</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {jobs.map((job: any) => (
                                          <tr key={`${job.namespace}-${job.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{job.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.completions}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.active}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.succeeded}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.failed}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="cronjobs">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suspend</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Schedule</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {cronJobs.map((cj: any) => (
                                          <tr key={`${cj.namespace}-${cj.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cj.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cj.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cj.schedule}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {cj.suspend ? 'Yes' : 'No'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cj.active}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cj.lastScheduleTime || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cj.age}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </TabsContent>
                            
                            <TabsContent value="namespaces">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {namespaces.map((ns: any) => (
                                      <tr key={ns.name}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ns.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                          <Badge className={
                                            ns.status === 'Active' ? 'bg-green-500' : 
                                            ns.status === 'Terminating' ? 'bg-red-500' : 'bg-yellow-500'
                                          }>
                                            {ns.status}
                                          </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ns.creationTimestamp}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="networking" className="pt-4">
                              <div className="mb-4 bg-green-50 dark:bg-green-950/20 p-3 rounded-md border border-green-100 dark:border-green-900/40">
                                <h3 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center mb-1">
                                  <Network className="h-4 w-4 mr-2" /> Networking
                                </h3>
                                <p className="text-xs text-green-600 dark:text-green-400">Configure network services, load balancing, and external access points.</p>
                              </div>
                              <Tabs defaultValue="services" value={networkingTab} onValueChange={setNetworkingTab}>
                                <TabsList className="flex overflow-x-auto py-1 mb-4 space-x-1 bg-green-50 dark:bg-green-950/30 rounded-md p-1 border border-green-100 dark:border-green-900">
                                  <TabsTrigger value="services" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Services</TabsTrigger>
                                  <TabsTrigger value="ingresses" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Ingresses</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="services">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster IP</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External IP</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ports</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {services.map((svc: any) => (
                                          <tr key={`${svc.namespace}-${svc.name}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{svc.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.namespace}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              <Badge className={
                                                svc.type === 'LoadBalancer' ? 'bg-blue-100 text-blue-800' :
                                                svc.type === 'NodePort' ? 'bg-purple-100 text-purple-800' :
                                                svc.type === 'ExternalName' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                              }>
                                                {svc.type}
                                              </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.clusterIP}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.externalIP || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {svc.ports && svc.ports.map ? svc.ports.map((port: any) => (
                                                <div key={`${port.port}-${port.protocol}`}>
                                                  {port.port}:{port.nodePort || port.port}/{port.protocol}
                                                </div>
                                              )) : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="ingresses">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hosts</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingress Class</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TLS</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {ingresses.length === 0 ? (
                                          <tr>
                                            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No ingress resources found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          ingresses.map((ingress: any) => (
                                            <tr key={`${ingress.namespace}-${ingress.name}`}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ingress.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ingress.namespace}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {ingress.hosts?.map((host: string) => (
                                                  <div key={host}>{host}</div>
                                                )) || '-'}
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ingress.ingressClassName || '-'}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {ingress.tls ? 'Enabled' : 'Disabled'}
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ingress.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </TabsContent>
                            <TabsContent value="configurations" className="pt-4">
                              <div className="mb-4 bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md border border-purple-100 dark:border-purple-900/40">
                                <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center mb-1">
                                  <Database className="h-4 w-4 mr-2" /> Configurations
                                </h3>
                                <p className="text-xs text-purple-600 dark:text-purple-400">Manage configuration data, secrets, and resource constraints for your applications.</p>
                              </div>
                              <Tabs value={configurationsTab} onValueChange={setConfigurationsTab}>
                                <TabsList className="flex overflow-x-auto py-1 mb-4 space-x-1 bg-purple-50 dark:bg-purple-950/30 rounded-md p-1 border border-purple-100 dark:border-purple-900">
                                  <TabsTrigger value="configmaps" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">ConfigMaps</TabsTrigger>
                                  <TabsTrigger value="secrets" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Secrets</TabsTrigger>
                                  <TabsTrigger value="resourcequotas" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">ResourceQuotas</TabsTrigger>
                                  <TabsTrigger value="limitranges" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">LimitRanges</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="configmaps">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Items</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {configMaps.length === 0 ? (
                                          <tr>
                                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No ConfigMaps found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          configMaps.map((cm: any) => (
                                            <tr key={`${cm.namespace}-${cm.name}`}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cm.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.namespace}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.dataCount || 0}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="secrets">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Items</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {secrets.length === 0 ? (
                                          <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No Secrets found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          secrets.map((secret: any) => (
                                            <tr key={`${secret.namespace}-${secret.name}`}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{secret.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.namespace}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.type}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.dataCount || 0}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="resourcequotas">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hard Limit</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {resourceQuotas.length === 0 ? (
                                          <tr>
                                            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No ResourceQuotas found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          resourceQuotas.flatMap((quota: any) => 
                                            Object.entries(quota.resources || {}).map(([resource, values]: [string, any]) => (
                                              <tr key={`${quota.namespace}-${quota.name}-${resource}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quota.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quota.namespace}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resource}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{values.used || '0'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{values.hard || 'Not Set'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quota.age}</td>
                                              </tr>
                                            ))
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="limitranges">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {limitRanges.length === 0 ? (
                                          <tr>
                                            <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No LimitRanges found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          limitRanges.flatMap((limit: any) => 
                                            (limit.limits || []).map((limitItem: any, index: number) => (
                                              <tr key={`${limit.namespace}-${limit.name}-${index}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{limit.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limit.namespace}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limitItem.type}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limitItem.resource}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limitItem.min || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limitItem.max || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limitItem.default || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{limit.age}</td>
                                              </tr>
                                            ))
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </TabsContent>
                            
                            <TabsContent value="storage" className="pt-4">
                              <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md border border-amber-100 dark:border-amber-900/40">
                                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center mb-1">
                                  <Database className="h-4 w-4 mr-2" /> Storage
                                </h3>
                                <p className="text-xs text-amber-600 dark:text-amber-400">Manage persistent storage resources for your cluster's applications.</p>
                              </div>
                              <Tabs value={storageTab} onValueChange={setStorageTab}>
                                <TabsList className="flex overflow-x-auto py-1 mb-4 space-x-1 bg-amber-50 dark:bg-amber-950/30 rounded-md p-1 border border-amber-100 dark:border-amber-900">
                                  <TabsTrigger value="persistentvolumes" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Persistent Volumes</TabsTrigger>
                                  <TabsTrigger value="persistentvolumeclaims" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Persistent Volume Claims</TabsTrigger>
                                  <TabsTrigger value="storageclasses" className="text-sm py-1 px-3 bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Storage Classes</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="persistentvolumes">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Modes</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reclaim Policy</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Storage Class</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {persistentVolumes.length === 0 ? (
                                          <tr>
                                            <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No PersistentVolumes found
                                            </td>
                                          </tr>
                                        ) : (
                                          persistentVolumes.map((pv: any) => (
                                            <tr key={pv.name}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pv.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.capacity}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.accessModes.join(', ')}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.reclaimPolicy}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <Badge className={
                                                  pv.status === 'Bound' ? 'bg-green-100 text-green-800' :
                                                  pv.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                                                  pv.status === 'Released' ? 'bg-yellow-100 text-yellow-800' :
                                                  'bg-gray-100 text-gray-800'
                                                }>
                                                  {pv.status}
                                                </Badge>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.claim || '-'}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.storageClass}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pv.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="persistentvolumeclaims">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Modes</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Storage Class</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {persistentVolumeClaims.length === 0 ? (
                                          <tr>
                                            <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No PersistentVolumeClaims found in this namespace
                                            </td>
                                          </tr>
                                        ) : (
                                          persistentVolumeClaims.map((pvc: any) => (
                                            <tr key={`${pvc.namespace}-${pvc.name}`}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pvc.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.namespace}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <Badge className={
                                                  pvc.status === 'Bound' ? 'bg-green-100 text-green-800' :
                                                  pvc.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                  'bg-gray-100 text-gray-800'
                                                }>
                                                  {pvc.status}
                                                </Badge>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.volumeName || '-'}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.capacity || '-'}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.accessModes.join(', ')}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.storageClass}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pvc.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="storageclasses">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provisioner</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reclaim Policy</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume Binding Mode</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allow Volume Expansion</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {storageClasses.length === 0 ? (
                                          <tr>
                                            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                              No StorageClasses found
                                            </td>
                                          </tr>
                                        ) : (
                                          storageClasses.map((sc: any) => (
                                            <tr key={sc.name}>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sc.name}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sc.provisioner}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sc.reclaimPolicy}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sc.volumeBindingMode}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sc.allowVolumeExpansion ? 'Yes' : 'No'}</td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sc.age}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </TabsContent>
                            
                            <TabsContent value="clusterinfo">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                  <h2 className="text-xl font-medium mb-4">Cluster Information</h2>
                                  
                                  <dl className="grid grid-cols-1 gap-4">
                                    <div className="flex items-start">
                                      <dt className="w-32 font-medium flex items-center">
                                        <Server className="h-4 w-4 mr-2 opacity-70" /> Provider:
                                      </dt>
                                      <dd>
                                        {getTypeBadge(cluster.type)}
                                      </dd>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <dt className="w-32 font-medium flex items-center">
                                        <Cpu className="h-4 w-4 mr-2 opacity-70" /> Version:
                                      </dt>
                                      <dd>Kubernetes v{cluster.version}</dd>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <dt className="w-32 font-medium flex items-center">
                                        <Network className="h-4 w-4 mr-2 opacity-70" /> API Server:
                                      </dt>
                                      <dd className="text-sm font-mono">{kubeConfigDetails?.server || 'Unknown'}</dd>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <dt className="w-32 font-medium flex items-center">
                                        <Globe className="h-4 w-4 mr-2 opacity-70" /> Region:
                                      </dt>
                                      <dd>{cluster.region}</dd>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <dt className="w-32 font-medium flex items-center">
                                        <UserIcon className="h-4 w-4 mr-2 opacity-70" /> Auth Type:
                                      </dt>
                                      <dd>{kubeConfigDetails?.authType || 'Unknown'}</dd>
                                    </div>
                                  </dl>
                                </div>
                                
                                {cluster.aws_account_id && (
                                  <div>
                                    <h2 className="text-xl font-medium mb-4">AWS Information</h2>
                                    <dl className="grid grid-cols-1 gap-4">
                                      <div className="flex items-center">
                                        <dt className="w-32 font-medium">Account ID:</dt>
                                        <dd className="font-mono">{cluster.aws_account_id}</dd>
                                      </div>
                                      
                                      <div className="flex items-center">
                                        <dt className="w-32 font-medium">EKS Cluster:</dt>
                                        <dd className="font-mono">{cluster.eks_cluster_name}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="monitoring" className="pt-4">
                              <div className="mb-4 bg-cyan-50 dark:bg-cyan-950/20 p-3 rounded-md border border-cyan-100 dark:border-cyan-900/40">
                                <h3 className="text-sm font-medium text-cyan-800 dark:text-cyan-300 flex items-center mb-1">
                                  <BarChart3 className="h-4 w-4 mr-2" /> Monitoring & Logging
                                </h3>
                                <p className="text-xs text-cyan-600 dark:text-cyan-400">View performance metrics and system logs from your cluster's components.</p>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <h2 className="text-lg font-medium mb-4">Cluster Resource Usage</h2>
                                  
                                  <div className="space-y-6">
                                    <div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">CPU Usage</span>
                                        <span className="text-sm text-gray-500">
                                          {metrics?.cpu?.used || '0'} / {metrics?.cpu?.total || '0'} cores
                                        </span>
                                      </div>
                                      <Progress value={metrics?.cpu?.percentUsed || 0} 
                                        className="h-2 w-full bg-gray-200" 
                                        indicatorClassName={`${(metrics?.cpu?.percentUsed || 0) > 80 ? 'bg-red-500' : (metrics?.cpu?.percentUsed || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                      />
                                    </div>
                                    
                                    <div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Memory Usage</span>
                                        <span className="text-sm text-gray-500">
                                          {metrics?.memory?.used || '0'} / {metrics?.memory?.total || '0'}
                                        </span>
                                      </div>
                                      <Progress value={metrics?.memory?.percentUsed || 0} 
                                        className="h-2 w-full bg-gray-200" 
                                        indicatorClassName={`${(metrics?.memory?.percentUsed || 0) > 80 ? 'bg-red-500' : (metrics?.memory?.percentUsed || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                      />
                                    </div>
                                    
                                    <div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Pod Capacity</span>
                                        <span className="text-sm text-gray-500">
                                          {metrics?.pods?.used || '0'} / {metrics?.pods?.total || '0'} pods
                                        </span>
                                      </div>
                                      <Progress value={metrics?.pods?.percentUsed || 0} 
                                        className="h-2 w-full bg-gray-200" 
                                        indicatorClassName={`${(metrics?.pods?.percentUsed || 0) > 80 ? 'bg-red-500' : (metrics?.pods?.percentUsed || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <h2 className="text-lg font-medium mb-4">Recent Logs</h2>
                                  
                                  {logs.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                      <HelpCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                      <p>No logs available</p>
                                    </div>
                                  ) : (
                                    <ScrollArea className="h-96">
                                      <pre className="text-xs font-mono whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200">
                                        {logs.map((log: string, index: number) => (
                                          <div key={index} className="pb-1">{log}</div>
                                        ))}
                                      </pre>
                                    </ScrollArea>
                                  )}
                                </div>
                              </div>
                            </TabsContent>
                            <TabsContent value="migration" className="pt-4">
                              <div className="mb-4 bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 flex items-center mb-1">
                                  <Globe className="h-4 w-4 mr-2" /> Component Migration
                                </h3>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                  Select components from this cluster to migrate to a multi-tenant cluster.
                                </p>
                              </div>

                              {/* Migration Progress Display */}
                              {migrationStatus === 'in-progress' && (
                                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100">
                                  <div className="flex items-center mb-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                                    <h4 className="text-sm font-medium text-blue-800">Migration in progress</h4>
                                  </div>
                                  <Progress value={migrationProgress} className="h-2 mb-2" />
                                  <p className="text-xs text-blue-600">{migrationProgress}% complete</p>
                                </div>
                              )}
                              
                              {migrationStatus === 'completed' && (
                                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-100">
                                  <div className="flex items-center">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                                    <h4 className="text-sm font-medium text-green-800">Migration completed successfully</h4>
                                  </div>
                                  <p className="text-xs text-green-600 mt-1">All selected resources have been migrated.</p>
                                </div>
                              )}
                              
                              {migrationStatus === 'failed' && (
                                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-100">
                                  <div className="flex items-center">
                                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                                    <h4 className="text-sm font-medium text-red-800">Migration failed</h4>
                                  </div>
                                  <p className="text-xs text-red-600 mt-1">{migrationError}</p>
                                </div>
                              )}

                              <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-3">
                                  <select
                                    className="border rounded px-3 py-1 text-sm"
                                    value={resourceType}
                                    onChange={(e) => setResourceType(e.target.value)}
                                  >
                                    <option value="deployments">Deployments</option>
                                    <option value="statefulsets">StatefulSets</option>
                                    <option value="daemonsets">DaemonSets</option>
                                    <option value="services">Services</option>
                                    <option value="configmaps">ConfigMaps</option>
                                    <option value="secrets">Secrets</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-500 flex items-center">
                                    <div className="flex items-center gap-1 mr-3">
                                      {Object.keys(componentCounts).length > 0 ? (
                                        Object.entries(componentCounts).map(([kind, count]) => (
                                          <Badge key={kind} variant="outline" className="bg-indigo-50 text-indigo-700">
                                            {kind}: {count}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span>No components selected</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <select
                                      className="border rounded px-3 py-1 text-sm"
                                      value={targetCluster?.id || ''}
                                      onChange={(e) => {
                                        const selected = availableTargetClusters.find(c => c.id === e.target.value);
                                        setTargetCluster(selected || null);
                                      }}
                                      disabled={isLoadingTargetClusters || availableTargetClusters.length === 0}
                                    >
                                      {isLoadingTargetClusters ? (
                                        <option>Loading target clusters...</option>
                                      ) : availableTargetClusters.length === 0 ? (
                                        <option>No target clusters available</option>
                                      ) : (
                                        availableTargetClusters.map(c => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                      )}
                                    </select>
                                    
                                    {/* Migration Options Menu */}
                                    <div className="relative ml-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowMigrationOptions(!showMigrationOptions)}
                                        className="flex items-center"
                                      >
                                        <Settings className="h-4 w-4 mr-1" /> Options
                                      </Button>
                                      
                                      {showMigrationOptions && (
                                        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-md p-4 z-10 w-64">
                                          <h4 className="text-sm font-medium mb-3">Migration Options</h4>
                                          
                                          <div className="space-y-3">
                                            <div className="space-y-1">
                                              <Label htmlFor="target-namespace" className="text-xs">Target Namespace</Label>
                                              <input
                                                id="target-namespace"
                                                type="text"
                                                className="w-full p-1 text-sm rounded-md border"
                                                placeholder="default"
                                                value={migrationOptions.targetNamespace}
                                                onChange={(e) => setMigrationOptions(prev => ({
                                                  ...prev,
                                                  targetNamespace: e.target.value
                                                }))}
                                              />
                                              <p className="text-xs text-muted-foreground">Leave empty to preserve original namespaces</p>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                              <Checkbox 
                                                id="preserve-node-affinity"
                                                checked={migrationOptions.preserveNodeAffinity}
                                                onCheckedChange={(checked) => setMigrationOptions(prev => ({
                                                  ...prev,
                                                  preserveNodeAffinity: checked === true
                                                }))}
                                              />
                                              <Label htmlFor="preserve-node-affinity" className="text-xs">Preserve Node Affinity</Label>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                              <Checkbox 
                                                id="migrate-volumes"
                                                checked={migrationOptions.migrateVolumes}
                                                onCheckedChange={(checked) => setMigrationOptions(prev => ({
                                                  ...prev,
                                                  migrateVolumes: checked === true
                                                }))}
                                              />
                                              <Label htmlFor="migrate-volumes" className="text-xs">Migrate Volumes</Label>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <Button
                                      size="sm"
                                      className="flex items-center"
                                      onClick={handleDirectMigrate}
                                      disabled={
                                        isMigrationLoading || 
                                        Object.keys(selectedComponents).filter(key => selectedComponents[key]).length === 0 ||
                                        !targetCluster
                                      }
                                    >
                                      {isMigrationLoading ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Migrating...
                                        </>
                                      ) : (
                                        <>
                                          <Cloud className="h-4 w-4 mr-2" /> Migrate Now
                                        </>
                                      )}
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      className="flex items-center"
                                      onClick={handleGenerateYaml}
                                      disabled={isMigrationLoading || Object.keys(selectedComponents).filter(key => selectedComponents[key]).length === 0}
                                    >
                                      {isMigrationLoading ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
                                        </>
                                      ) : (
                                        <>
                                          <DownloadCloud className="h-4 w-4 mr-2" /> Generate YAML
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-md border shadow-sm">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                                          Select
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Namespace
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          {resourceType === 'deployments' ? 'Replicas' : 
                                           resourceType === 'statefulsets' ? 'Replicas' :
                                           resourceType === 'daemonsets' ? 'Nodes' :
                                           resourceType === 'services' ? 'Type' :
                                           resourceType === 'configmaps' ? 'Data Items' :
                                           resourceType === 'secrets' ? 'Type' : 'Status'}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Age
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {resourceType === 'deployments' && deployments.map((deployment: any) => (
                                        <tr key={`${deployment.namespace}-${deployment.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`Deployment|${deployment.namespace}|${deployment.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('Deployment', deployment.namespace, deployment.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{deployment.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deployment.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {deployment.replicas.current}/{deployment.replicas.desired}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deployment.age}</td>
                                        </tr>
                                      ))}
                                      {resourceType === 'statefulsets' && statefulSets.map((sts: any) => (
                                        <tr key={`${sts.namespace}-${sts.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`StatefulSet|${sts.namespace}|${sts.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('StatefulSet', sts.namespace, sts.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sts.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {sts.replicas.current}/{sts.replicas.desired}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sts.age}</td>
                                        </tr>
                                      ))}
                                      {resourceType === 'daemonsets' && daemonSets.map((ds: any) => (
                                        <tr key={`${ds.namespace}-${ds.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`DaemonSet|${ds.namespace}|${ds.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('DaemonSet', ds.namespace, ds.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ds.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {ds.desiredNumberScheduled}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.age}</td>
                                        </tr>
                                      ))}
                                      {resourceType === 'services' && services.map((svc: any) => (
                                        <tr key={`${svc.namespace}-${svc.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`Service|${svc.namespace}|${svc.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('Service', svc.namespace, svc.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{svc.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <Badge className={
                                              svc.type === 'LoadBalancer' ? 'bg-blue-100 text-blue-800' :
                                              svc.type === 'NodePort' ? 'bg-purple-100 text-purple-800' :
                                              svc.type === 'ExternalName' ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-gray-100 text-gray-800'
                                            }>
                                              {svc.type}
                                            </Badge>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.age}</td>
                                        </tr>
                                      ))}
                                      {resourceType === 'configmaps' && configMaps.map((cm: any) => (
                                        <tr key={`${cm.namespace}-${cm.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`ConfigMap|${cm.namespace}|${cm.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('ConfigMap', cm.namespace, cm.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cm.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.dataCount || 0}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cm.age}</td>
                                        </tr>
                                      ))}
                                      {resourceType === 'secrets' && secrets.map((secret: any) => (
                                        <tr key={`${secret.namespace}-${secret.name}`} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <Checkbox 
                                              checked={!!selectedComponents[`Secret|${secret.namespace}|${secret.name}`]} 
                                              onCheckedChange={() => toggleComponentSelection('Secret', secret.namespace, secret.name)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{secret.name}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.namespace}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.type}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{secret.age}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* YAML Preview Dialog */}
                              <Dialog open={isMigrationYamlOpen} onOpenChange={setIsMigrationYamlOpen}>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle>Generated YAML for Migration</DialogTitle>
                                    <DialogDescription>
                                      This YAML represents the selected components that will be migrated.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex-1 overflow-auto">
                                    <ScrollArea className="h-[50vh]">
                                      <pre className="text-xs bg-gray-50 p-4 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                                        {migrationYaml}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                  <DialogFooter className="flex justify-between items-center mt-4">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        // In a real implementation, this would copy to clipboard
                                        navigator.clipboard.writeText(migrationYaml);
                                        toast.success('YAML copied to clipboard');
                                      }}
                                    >
                                      <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
                                    </Button>
                                    <Button
                                      onClick={() => setIsMigrationYamlOpen(false)}
                                    >
                                      Close
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </TabsContent>
                            {cluster?.type === 'tenant' && (
                              <TabsContent value="tenant" className="pt-4">
                                <div className="mb-4 bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md border border-purple-100 dark:border-purple-900/40">
                                  <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center mb-1">
                                    <Users className="h-4 w-4 mr-2" /> Multi-Tenant Resources
                                  </h3>
                                  <p className="text-xs text-purple-600 dark:text-purple-400">
                                    View and manage resources across all tenant namespaces in this multi-tenant cluster.
                                  </p>
                                </div>
                                <TenantResources cluster={cluster} />
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      ) : (
                        <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-md">
                          <div className="flex items-start">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                            <div>
                              <h3 className="font-medium">Cluster Connection Error</h3>
                              <p className="mt-1">{liveStatusError || 'Failed to connect to cluster'}</p>
                              <div className="mt-3 space-y-2 text-sm">
                                <p>Possible reasons:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                  <li>The cluster has been deleted or is not running</li>
                                  <li>Network connectivity issues</li>
                                  <li>Authentication credentials expired or revoked</li>
                                  <li>Invalid or expired kubeconfig</li>
                                </ul>
                                <Button 
                                  size="sm" 
                                  className="mt-3"
                                  onClick={handleManualRefresh}
                                >
                                  Try Again
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-8">
                <Button 
                  variant="outline" 
                  className="mr-4" 
                  onClick={() => navigate('/checkpoints')}
                >
                  View Checkpoints
                </Button>
                
                {/* Show migration button for single clusters */}
                {cluster?.type === 'single' && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">Cluster Actions</h2>
                    <div className="flex space-x-4">
                      <Button 
                        className="flex-1" 
                        onClick={handleMigrateToMultiTenant}
                      >
                        Migrate to Multi-Tenant
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleDownloadConfig}
                      >
                        Download Kubeconfig
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {cluster.kubeconfig && !liveClusterStatus && (
                <div className="mt-8 border-t pt-8 border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-medium mb-4">Kubeconfig Details</h2>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                    <div className="grid grid-cols-1 gap-4">
                      {getKubeconfigDetails(cluster.kubeconfig)}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4" 
                      onClick={handleDownloadConfig}
                    >
                      <DownloadCloud className="h-4 w-4 mr-2" /> Download Full Kubeconfig
                    </Button>
                  </div>
                </div>
              )}

              {/* Display Kubeconfig Details Section */}
              {cluster && cluster.kubeconfig && (
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Kubeconfig Details</h2>
                  
                  {isLoadingKubeConfigDetails ? (
                    <div className="flex justify-center items-center p-10">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                      <span className="ml-3">Loading kubeconfig details...</span>
                    </div>
                  ) : kubeConfigDetails ? (
                    <div className="space-y-6">
                      {/* Display Kubeconfig Information */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-sm">
                          API Version: {kubeConfigDetails.apiVersion}
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          Kind: {kubeConfigDetails.kind}
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          Current Context: {kubeConfigDetails.currentContext}
                        </Badge>
                      </div>
                      
                      {/* Display clusters information */}
                      <div>
                        <h3 className="text-lg font-medium mb-2">Clusters</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {kubeConfigDetails.clusters.map((cluster: any, index: number) => (
                            <div key={index} className="border rounded-md p-4 bg-gray-50">
                              <h4 className="font-medium mb-2">{cluster.name}</h4>
                              <div className="space-y-1">
                                <p className="text-sm"><span className="font-medium">Server:</span> {cluster.server}</p>
                                <p className="text-sm">
                                  <span className="font-medium">Certificate Authority:</span> 
                                  {cluster.certificateAuthorityPresent ? 
                                    <span className="text-green-600 ml-1">Available</span> : 
                                    <span className="text-red-600 ml-1">Missing</span>}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Display contexts information */}
                      <div>
                        <h3 className="text-lg font-medium mb-2">Contexts</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {kubeConfigDetails.contexts.map((context: any, index: number) => (
                              <div 
                                key={index} 
                                className={`border rounded-md p-4 ${context.name === kubeConfigDetails.currentContext ? 
                                  'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}
                              >
                                <h4 className="font-medium mb-2 flex items-center">
                                  {context.name}
                                  {context.name === kubeConfigDetails.currentContext && (
                                    <Badge className="ml-2 bg-blue-500">Current</Badge>
                                  )}
                                </h4>
                                <div className="space-y-1">
                                  <p className="text-sm"><span className="font-medium">Cluster:</span> {context.cluster}</p>
                                  <p className="text-sm"><span className="font-medium">User:</span> {context.user}</p>
                                  {context.namespace && (
                                    <p className="text-sm"><span className="font-medium">Namespace:</span> {context.namespace}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Display users information */}
                        <div>
                          <h3 className="text-lg font-medium mb-2">Users</h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {kubeConfigDetails.users.map((user: any, index: number) => (
                              <div key={index} className="border rounded-md p-4 bg-gray-50">
                                <h4 className="font-medium mb-2">{user.name}</h4>
                                <div className="space-y-1">
                                  <div className="text-sm">
                                    <span className="font-medium">Auth Type:</span> 
                                    <Badge className="ml-1">
                                      {user.authType.charAt(0).toUpperCase() + user.authType.slice(1)}
                                    </Badge>
                                  </div>
                                  {user.execCommand && (
                                    <div>
                                      <p className="text-sm font-medium">Command:</p>
                                      <code className="text-xs bg-gray-100 p-1 rounded block mt-1">
                                        {user.execCommand} {user.execArgs ? user.execArgs.join(' ') : ''}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Display AWS specific info if available */}
                        {kubeConfigDetails.awsInfo && (
                          <div>
                            <h3 className="text-lg font-medium mb-2">AWS Information</h3>
                            <div className="border rounded-md p-4 bg-gray-50">
                              <div className="space-y-1">
                                {kubeConfigDetails.awsInfo.clusterName && (
                                  <p className="text-sm"><span className="font-medium">EKS Cluster Name:</span> {kubeConfigDetails.awsInfo.clusterName}</p>
                                )}
                                {kubeConfigDetails.awsInfo.region && (
                                  <p className="text-sm"><span className="font-medium">AWS Region:</span> {kubeConfigDetails.awsInfo.region}</p>
                                )}
                                {kubeConfigDetails.awsInfo.accountId && (
                                  <p className="text-sm"><span className="font-medium">AWS Account ID:</span> {kubeConfigDetails.awsInfo.accountId}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="text-center p-6">
                      <p>No kubeconfig details available</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Pod Details Dialog */}
              <Dialog open={isPodDetailsOpen} onOpenChange={setIsPodDetailsOpen}>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Pod Details: {selectedPod?.name}</DialogTitle>
                    <DialogDescription>
                      Namespace: {selectedPod?.namespace} • Status: {selectedPod?.status} • Node: {selectedPod?.node}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex flex-col space-y-4 overflow-hidden flex-grow">
                    <Tabs defaultValue="details" className="flex-grow flex flex-col overflow-hidden">
                      <TabsList>
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="yaml">YAML</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="details" className="flex-grow overflow-auto">
                        <ScrollArea className="h-[400px] rounded-md border p-4">
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium">Pod Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Name</h4>
                                <p>{selectedPod?.name}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Namespace</h4>
                                <p>{selectedPod?.namespace}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Status</h4>
                                <Badge className={
                                  selectedPod?.status === 'Running' ? 'bg-green-500' : 
                                  selectedPod?.status === 'Pending' ? 'bg-yellow-500' : 
                                  selectedPod?.status === 'Succeeded' ? 'bg-blue-500' : 'bg-red-500'
                                }>
                                  {selectedPod?.status}
                                </Badge>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Node</h4>
                                <p>{selectedPod?.node}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Age</h4>
                                <p>{selectedPod?.age}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-500">Restarts</h4>
                                <p className={selectedPod?.restarts > 0 ? "text-red-500 font-medium" : ""}>
                                  {selectedPod?.restarts}
                                </p>
                              </div>
                            </div>
                            
                            <h3 className="text-lg font-medium mt-6">Containers</h3>
                            <div className="space-y-4">
                              <div className="p-4 border rounded-md">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">main</h4>
                                  <Badge className="bg-green-500">Running</Badge>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <h5 className="font-medium text-gray-500">Image</h5>
                                    <p className="font-mono">nginx:latest</p>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-gray-500">Ports</h5>
                                    <p>80/TCP</p>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-gray-500">CPU Requests</h5>
                                    <p>100m</p>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-gray-500">Memory Requests</h5>
                                    <p>128Mi</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <h3 className="text-lg font-medium mt-6">Conditions</h3>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                                <span className="font-medium mr-2">PodScheduled:</span> True
                              </div>
                              <div className="flex items-center text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                                <span className="font-medium mr-2">Initialized:</span> True
                              </div>
                              <div className="flex items-center text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                                <span className="font-medium mr-2">ContainersReady:</span> True
                              </div>
                              <div className="flex items-center text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                                <span className="font-medium mr-2">Ready:</span> True
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="yaml" className="flex-grow flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">Pod Configuration</h3>
                          <div className="flex space-x-2">
                            {isEditing ? (
                              <>
                                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave}>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Changes
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => {
                                  navigator.clipboard.writeText(podYaml);
                                  toast.success("YAML copied to clipboard");
                                }}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy
                                </Button>
                                <Button size="sm" onClick={handleEdit}>
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-grow relative">
                          <Textarea
                            className="h-full min-h-[350px] font-mono text-sm"
                            value={isEditing ? editedYaml : podYaml}
                            onChange={(e) => setEditedYaml(e.target.value)}
                            readOnly={!isEditing}
                          />
                        </div>
                        
                        {isEditing && (
                          <div className="mt-2 text-sm text-gray-500">
                            <p>Edit the YAML configuration. Save changes to stage for deployment.</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="logs" className="flex-grow">
                        <ScrollArea className="h-[400px] rounded-md border p-4">
                          <pre className="font-mono text-xs whitespace-pre-wrap">
                            {`2023-07-15T10:14:32.876Z INFO  Starting Nginx server
2023-07-15T10:14:33.012Z INFO  Configuration loaded successfully
2023-07-15T10:14:33.102Z INFO  Server listening on port 80
2023-07-15T10:14:40.543Z INFO  GET /index.html 200 1324 - Mozilla/5.0 (Windows NT 10.0; Win64; x64)
2023-07-15T10:15:12.321Z INFO  GET /api/status 200 87 - Mozilla/5.0 (Windows NT 10.0; Win64; x64)
2023-07-15T10:15:43.876Z INFO  GET /api/health 200 42 - kube-probe/1.25
2023-07-15T10:16:43.912Z INFO  GET /api/health 200 42 - kube-probe/1.25
2023-07-15T10:17:44.043Z INFO  GET /api/health 200 42 - kube-probe/1.25`}
                          </pre>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPodDetailsOpen(false)}>Close</Button>
                    {!isEditing && podYaml === editedYaml && (
                      <Button 
                        variant="default"
                        onClick={handleDeploy}
                        disabled={isEditing}
                      >
                        Deploy
                      </Button>
                    )}
                    {!isEditing && podYaml !== editedYaml && (
                      <Button 
                        variant="default"
                        onClick={handleDeploy}
                      >
                        Deploy Changes
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Deploy Changes Dialog */}
              <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Deploy Changes</DialogTitle>
                    <DialogDescription>
                      Choose where to deploy the configuration changes
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4">
                    <div className="mb-4 flex items-center space-x-2">
                      <Checkbox 
                        id="current-tenant" 
                        checked={true} 
                        disabled 
                      />
                      <Label htmlFor="current-tenant" className="font-medium">
                        Deploy to current tenant ({cluster?.name})
                      </Label>
                    </div>
                    
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium mb-2">Also deploy to:</h4>
                      <div className="space-y-2">
                        {availableTenants.map((tenant) => (
                          <div key={tenant.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`tenant-${tenant.id}`}
                              checked={selectedTenants[tenant.id] || false}
                              onCheckedChange={(checked) => 
                                handleTenantSelection(tenant.id, checked === true)
                              }
                            />
                            <Label htmlFor={`tenant-${tenant.id}`} className="flex items-center">
                              <span className="mr-2">{tenant.name}</span>
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800">
                                {tenant.region}
                              </Badge>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeployDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleDeployChanges}>
                      Deploy
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ClusterDetails;