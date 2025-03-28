import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/supabase';
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
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

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
          }
          
          // Start fetching live status
          fetchLiveStatus(data.kubeconfig);
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
    try {
      const status = await fetchClusterStatus(kubeconfig);
      setLiveClusterStatus(status);
      setLastUpdated(new Date().toLocaleTimeString());
      
      // If this is the first successful fetch, set up auto-refresh
      if (autoRefreshEnabled && !autoRefreshTimerRef.current) {
        setupAutoRefresh(kubeconfig);
      }
    } catch (error) {
      console.error('Error fetching live status:', error);
      toast.error('Failed to fetch live cluster status');
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
    
    // Set new timer to refresh every 5 seconds
    autoRefreshTimerRef.current = setInterval(() => {
      if (autoRefreshEnabled) {
        fetchLiveStatus(kubeconfig);
      }
    }, 5000);
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
  
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      running: { class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: <Check className="h-4 w-4 mr-1" /> },
      pending: { class: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: <Clock className="h-4 w-4 mr-1" /> },
      failed: { class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: <X className="h-4 w-4 mr-1" /> }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <Badge variant="outline" className={`${config.class} px-2 py-1 flex items-center text-xs`}>
        {config.icon}
        <span className="capitalize">{status}</span>
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

  // Function for manual refresh
  const handleManualRefresh = async () => {
    if (cluster?.kubeconfig) {
      try {
        const status = await fetchClusterStatus(cluster.kubeconfig);
        setLiveClusterStatus(status);
        setLastUpdated(new Date().toLocaleTimeString());
        setLiveStatusError('');
        toast.success('Status refreshed');
      } catch (error: any) {
        console.error('Error refreshing live status:', error);
        setLiveStatusError(error.message || 'Failed to refresh live status');
        setLiveClusterStatus(null);
        toast.error('Failed to refresh status');
      }
    }
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-subtle overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center">
                      <Server className="h-6 w-6 text-primary mr-3" />
                      <h1 className="text-2xl font-bold">{cluster.name}</h1>
                      <div className="ml-4">{getStatusBadge(cluster.status)}</div>
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
                            <Badge variant="outline" className={cluster.type === 'single' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'}>
                              {cluster.type === 'single' ? 'Single Cluster' : 'Multi Cluster'}
                            </Badge>
                            
                            {cluster.type === 'single' && (
                              <Button 
                                variant="link" 
                                className="text-xs p-0 h-auto ml-2" 
                                onClick={handleMigrate}
                              >
                                Migrate to Multi-Cluster
                              </Button>
                            )}
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
                            <TabsList className="mb-4">
                              <TabsTrigger value="nodes">Nodes</TabsTrigger>
                              <TabsTrigger value="pods">Pods</TabsTrigger>
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
                                      <tr key={`${pod.namespace}-${pod.name}`}>
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
                          </Tabs>
                        </div>
                      ) : (
                        <div className="p-4 bg-red-50 text-red-600 rounded-md">
                          <p>Error connecting to cluster: {liveStatusError}</p>
                          <p className="mt-2 text-sm">
                            Make sure kubectl is installed and your kubeconfig is valid.
                          </p>
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
                
                {cluster.type === 'single' && (
                  <Button onClick={handleMigrate}>
                    Migrate to Multi-Cluster
                  </Button>
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
            </>
          ) : null}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ClusterDetails; 