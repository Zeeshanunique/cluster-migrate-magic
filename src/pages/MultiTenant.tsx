import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClusterCard from '@/components/clusters/ClusterCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertCircle, 
  Loader2, 
  Plus, 
  Search, 
  Globe,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { Cluster, clusterService } from '@/utils/supabase';

const MultiTenant = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadClusters = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setConnectionError(null);
      
      try {
        console.log('Loading multi-tenant clusters for user:', user.id);
        const data = await clusterService.getAllClusters(user.id);
        // Filter to only show tenant-type clusters
        const multiTenantClusters = data.filter(cluster => cluster.type === 'tenant');
        setClusters(multiTenantClusters);
        console.log('Multi-tenant clusters loaded successfully:', multiTenantClusters.length);
      } catch (error) {
        console.error('Error loading multi-tenant clusters:', error);
        toast.error('Failed to load multi-tenant clusters');
        setConnectionError('Could not retrieve multi-tenant clusters. Please check your Supabase setup.');
      } finally {
        setIsLoading(false);
      }
    };

    loadClusters();
  }, [user]);
  
  const handleClusterDeleted = (clusterId: string) => {
    setClusters(prevClusters => prevClusters.filter(c => c.id !== clusterId));
  };
  
  const handleClusterRestarted = (clusterId: string) => {
    if (user) {
      clusterService.getClusterById(clusterId).then(updatedCluster => {
        if (updatedCluster) {
          setClusters(prevClusters => 
            prevClusters.map(c => c.id === clusterId ? updatedCluster : c)
          );
        }
      });
    }
  };
  
  const filteredClusters = clusters.filter(cluster => {
    return cluster.name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const handleRetry = () => {
    if (user) {
      setIsLoading(true);
      
      clusterService.getAllClusters(user.id)
        .then(data => {
          const multiTenantClusters = data.filter(cluster => cluster.type === 'tenant');
          setClusters(multiTenantClusters);
          setConnectionError(null);
        })
        .catch(error => {
          console.error('Error retrying multi-tenant cluster load:', error);
          toast.error('Still unable to load multi-tenant clusters');
          setConnectionError('Could not connect to Supabase. Please check your connection.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Multi-Tenant Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage your Kubernetes multi-tenant environments
              </p>
            </div>
            
            <Button onClick={() => navigate('/add-cluster')}>
              <Plus className="mr-2 h-4 w-4" /> Add Cluster
            </Button>
          </div>
          
          {connectionError && (
            <div className="mb-6 p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Connection Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{connectionError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetry} 
                    className="mt-2 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    Retry Connection
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Server className="h-6 w-6 text-primary mr-3" />
                <div>
                  <h3 className="text-lg font-medium mb-1">Total Multi-Tenant Clusters</h3>
                  <p className="text-3xl font-bold">{clusters.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Globe className="h-6 w-6 text-primary mr-3" />
                <div>
                  <h3 className="text-lg font-medium mb-1">Total Nodes</h3>
                  <p className="text-3xl font-bold">
                    {clusters.reduce((acc, cluster) => acc + cluster.nodes, 0)}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Across all multi-tenant clusters
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search multi-tenant clusters..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-12 flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p>Loading multi-tenant clusters...</p>
            </div>
          ) : filteredClusters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClusters.map((cluster) => (
                <ClusterCard 
                  key={cluster.id} 
                  cluster={cluster}
                  onDelete={handleClusterDeleted}
                  onRestart={handleClusterRestarted}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <Server className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-4">No multi-tenant clusters found</p>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Multi-tenant clusters enable you to manage workloads across multiple Kubernetes environments. 
                Create one or migrate an existing single tenant cluster.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate('/add-cluster')}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Multi-Tenant Cluster
              </Button>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default MultiTenant; 