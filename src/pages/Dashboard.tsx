import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClusterCard from '@/components/clusters/ClusterCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Plus, Search, Filter, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Cluster, clusterService } from '@/utils/dynamodb';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Force refresh when URL has refresh parameter (from migration page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refreshParam = urlParams.get('refresh');
    
    if (refreshParam) {
      // Clear the URL parameter without triggering page reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Show toast message
      toast.info("Refreshing dashboard data...");
      
      // Reload clusters data
      if (user) {
        loadClusters();
      }
    }
  }, [window.location.search]);
  
  const loadClusters = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      console.log('Loading clusters for user:', user.id);
      const data = await clusterService.getAllClusters(user.id);
      console.log('Clusters loaded successfully:', data.length);
      
      // Sort clusters by type and then by name for consistent display
      const sortedData = [...data].sort((a, b) => {
        // First sort by type (single first, then tenant)
        if (a.type !== b.type) {
          return a.type === 'single' ? -1 : 1;
        }
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
      
      setClusters(sortedData);
    } catch (error) {
      console.error('Error loading clusters:', error);
      toast.error('Failed to load clusters');
      setConnectionError('Could not connect to Supabase. Please check your Supabase setup - verify the clusters table exists and has proper RLS policies.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
    const matchesSearch = cluster.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || cluster.status === statusFilter;
    
    const matchesType = typeFilter === 'all' || cluster.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });
  
  const singleClusters = filteredClusters.filter(cluster => cluster.type === 'single');
  const multiTenantClusters = filteredClusters.filter(cluster => cluster.type === 'tenant');
  
  const handleRetry = () => {
    if (user) {
      setIsLoading(true);
      
      clusterService.getAllClusters(user.id)
        .then(data => {
          setClusters(data);
          setConnectionError(null);
        })
        .catch(error => {
          console.error('Error retrying cluster load:', error);
          toast.error('Still unable to load clusters');
          setConnectionError('Could not connect to Supabase. Please check your Supabase setup - verify the clusters table exists and has proper RLS policies.');
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
            <h1 className="text-3xl font-bold">Kubernetes Clusters</h1>
            
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
          
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-1">Total Clusters</h3>
              <p className="text-3xl font-bold">{clusters.length}</p>
              <div className="mt-2 text-sm text-muted-foreground">
                {singleClusters.length} single, {multiTenantClusters.length} multi-tenant
              </div>
              {multiTenantClusters.length > 0 && (
                <Button
                  variant="link"
                  className="px-0 mt-2 h-auto"
                  onClick={() => navigate('/multi-tenant')}
                >
                  View Multi-Tenant Clusters →
                </Button>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-1">Running</h3>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                {clusters.filter(c => c.status === 'running').length}
              </p>
              <div className="mt-2 text-sm text-muted-foreground">
                All systems operational
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-1">Total Nodes</h3>
              <p className="text-3xl font-bold">
                {clusters.reduce((acc, cluster) => acc + cluster.nodes, 0)}
              </p>
              <div className="mt-2 text-sm text-muted-foreground">
                Across all clusters
              </div>
            </div>
          </div>
          
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search clusters..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="tenant">Multi-Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {!connectionError && (
            <Tabs defaultValue="all" className="space-y-6">
              <TabsList>
                <TabsTrigger value="all">All Clusters</TabsTrigger>
                <TabsTrigger value="single">Single Clusters</TabsTrigger>
                <TabsTrigger value="multi">Multi Clusters</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6">
                {isLoading ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p>Loading clusters...</p>
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
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">No clusters found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => navigate('/add-cluster')}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Your First Cluster
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="single" className="mt-6">
                {isLoading ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p>Loading clusters...</p>
                  </div>
                ) : singleClusters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {singleClusters.map((cluster) => (
                      <ClusterCard 
                        key={cluster.id} 
                        cluster={cluster}
                        onDelete={handleClusterDeleted}
                        onRestart={handleClusterRestarted}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">No single-node clusters found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => navigate('/add-cluster')}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Single-Node Cluster
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="multi" className="mt-6">
                {isLoading ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p>Loading clusters...</p>
                  </div>
                ) : multiTenantClusters.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {multiTenantClusters.map((cluster) => (
                        <ClusterCard 
                          key={cluster.id} 
                          cluster={cluster}
                          onDelete={handleClusterDeleted}
                          onRestart={handleClusterRestarted}
                        />
                      ))}
                    </div>
                    {multiTenantClusters.length > 3 && (
                      <div className="mt-6 text-center">
                        <Button
                          variant="outline"
                          onClick={() => navigate('/multi-tenant')}
                        >
                          View All Multi-Tenant Clusters
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">No multi-tenant clusters found</p>
                    <p className="text-muted-foreground mb-4">
                      Multi-tenant clusters allow you to manage workloads across multiple environments
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/multi-tenant')}
                    >
                      Explore Multi-Tenant Management
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
