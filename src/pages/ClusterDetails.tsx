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
  Copy
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

const ClusterDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cluster, setCluster] = useState<Cluster | null>(null);
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
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [kubeConfigDetails, setKubeConfigDetails] = useState<any>(null);
  const [isLoadingKubeConfigDetails, setIsLoadingKubeConfigDetails] = useState(false);

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
    
    setIsLoadingLiveStatus(true);
    setLiveStatusError(null);
    
    try {
      const status = await fetchClusterStatus(kubeconfig);
      setLiveClusterStatus(status);
      setLastUpdated(new Date().toLocaleTimeString());
      setConsecutiveFailures(0); // Reset failure counter on success
      setConnectionFailed(false); // Reset connection failed flag
      
      // If this is the first successful fetch, set up auto-refresh
      if (autoRefreshEnabled && !autoRefreshTimerRef.current) {
        setupAutoRefresh(kubeconfig);
      }
    } catch (error: any) {
      console.error('Error fetching live status:', error);
      
      // Increment consecutive failures
      const newFailureCount = consecutiveFailures + 1;
      setConsecutiveFailures(newFailureCount);
      
      // Set connection failed flag immediately to update UI
      setConnectionFailed(true);

      // Update local UI immediately, even before updating database
      if (cluster && cluster.status !== 'failed') {
        // Update local state to immediately show failed status in UI
        setCluster({...cluster, status: 'failed'});
      }
      
      // Update cluster status to failed if connection consistently fails
      if (newFailureCount >= MAX_FAILURES_BEFORE_STATUS_UPDATE && cluster && cluster.status !== 'failed') {
        try {
          // Update the cluster status in the database to reflect the connection failure
          await clusterService.updateCluster(cluster.id, { status: 'failed' });
          toast.error(`Cluster "${cluster.name}" marked as failed due to connection issues`);
        } catch (updateError) {
          console.error('Error updating cluster status:', updateError);
        }
      }
      
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

  const handleMigrate = () => {
    navigate(`/migration?cluster=${cluster.id}`);
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
  
  // Function to fetch namespaces
  const fetchNamespaces = async (kubeconfig: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingNamespaces(true);
    
    try {
      const data = await apiRequest(
        KUBERNETES_API.GET_NAMESPACES,
        'POST',
        { kubeconfig }
      );
      
      if (data && data.items) {
        const namespacesList = data.items.map((ns: any) => ({
          name: ns.metadata.name,
          status: ns.status?.phase || 'Active',
          creationTimestamp: ns.metadata.creationTimestamp
        }));
        
        setNamespaces(namespacesList);
        
        // Set default namespace and fetch services for it
        if (namespacesList.length > 0) {
          const defaultNs = namespacesList.find((ns: any) => ns.name === 'default') || namespacesList[0];
          setSelectedNamespace(defaultNs.name);
          fetchServices(kubeconfig, defaultNs.name);
        }
      }
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      toast.error('Failed to fetch namespaces');
    } finally {
      setIsLoadingNamespaces(false);
    }
  };
  
  // Function to fetch services
  const fetchServices = async (kubeconfig: string, namespace: string) => {
    if (!kubeconfig) return;
    
    setIsLoadingServices(true);
    
    try {
      const data = await apiRequest(
        KUBERNETES_API.GET_SERVICES,
        'POST',
        { kubeconfig, namespace }
      );
      
      if (data && data.items) {
        const servicesList = data.items.map((svc: any) => ({
          name: svc.metadata.name,
          namespace: svc.metadata.namespace,
          type: svc.spec.type,
          clusterIP: svc.spec.clusterIP,
          ports: svc.spec.ports.map((port: any) => ({
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol
          })),
          creationTimestamp: svc.metadata.creationTimestamp
        }));
        
        setServices(servicesList);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to fetch services');
    } finally {
      setIsLoadingServices(false);
    }
  };
  
  // Handle namespace change
  const handleNamespaceChange = (namespace: string) => {
    setSelectedNamespace(namespace);
    if (cluster && cluster.kubeconfig) {
      fetchServices(cluster.kubeconfig, namespace);
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
          setCluster({...cluster, status: 'failed'});
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

                          <Tabs defaultValue="nodes" value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="mb-4 grid grid-cols-4">
                              <TabsTrigger value="nodes">Nodes</TabsTrigger>
                              <TabsTrigger value="pods">Pods</TabsTrigger>
                              <TabsTrigger value="namespaces">Namespaces</TabsTrigger>
                              <TabsTrigger value="services">Services</TabsTrigger>
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
                            
                            <TabsContent value="services">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster IP</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ports</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {services.map((svc: any) => (
                                      <tr key={svc.name}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{svc.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.namespace}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{svc.clusterIP}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {svc.ports.map((port: any) => (
                                            <div key={port.port}>{port.port}/{port.protocol}</div>
                                          ))}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TabsContent>
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
                                <p className="text-sm">
                                  <span className="font-medium">Auth Type:</span> 
                                  <Badge className="ml-1">
                                    {user.authType.charAt(0).toUpperCase() + user.authType.slice(1)}
                                  </Badge>
                                </p>
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