import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/supabase';
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
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const ClusterDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCluster = async () => {
      if (!user || !id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await clusterService.getClusterById(id);
        if (data) {
          setCluster(data);
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
  }, [user, id]);

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
    if (cluster) {
      navigate(`/migration?cluster=${cluster.id}`);
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
                      </dl>
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-medium mb-4">Provider Configuration</h2>
                      
                      {cluster.aws_account_id && (
                        <dl className="grid grid-cols-1 gap-4">
                          <div className="flex items-center">
                            <dt className="w-36 font-medium">AWS Account ID:</dt>
                            <dd className="truncate font-mono">{cluster.aws_account_id}</dd>
                          </div>
                          
                          {cluster.aws_role_arn && (
                            <div className="flex items-center">
                              <dt className="w-36 font-medium">AWS Role ARN:</dt>
                              <dd className="truncate font-mono">{cluster.aws_role_arn}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      
                      {!cluster.aws_account_id && (
                        <p className="text-muted-foreground">No provider configuration available</p>
                      )}
                    </div>
                  </div>
                  
                  {cluster.kubeconfig && (
                    <div className="mt-8">
                      <h2 className="text-xl font-medium mb-4">Kubeconfig</h2>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 font-mono text-sm overflow-auto max-h-80">
                        <pre>{cluster.kubeconfig}</pre>
                      </div>
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
            </>
          ) : null}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ClusterDetails; 