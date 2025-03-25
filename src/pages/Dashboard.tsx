
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
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
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Cluster, clusterService } from '@/utils/supabase';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Load clusters from Supabase
  useEffect(() => {
    const loadClusters = async () => {
      if (!isLoaded || !isSignedIn || !user) return;
      
      setIsLoading(true);
      try {
        const data = await clusterService.getAllClusters(user.id);
        setClusters(data);
      } catch (error) {
        console.error('Error loading clusters:', error);
        toast.error('Failed to load clusters');
      } finally {
        setIsLoading(false);
      }
    };

    loadClusters();
  }, [user, isSignedIn, isLoaded]);
  
  // Handle deleted clusters
  const handleClusterDeleted = (clusterId: string) => {
    setClusters(prevClusters => prevClusters.filter(c => c.id !== clusterId));
  };
  
  // Handle restarted clusters
  const handleClusterRestarted = (clusterId: string) => {
    // Refresh the cluster data
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
    // Search filter
    const matchesSearch = cluster.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || cluster.status === statusFilter;
    
    // Type filter
    const matchesType = typeFilter === 'all' || cluster.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });
  
  const singleClusters = filteredClusters.filter(cluster => cluster.type === 'single');
  const multiClusters = filteredClusters.filter(cluster => cluster.type === 'multi');
  
  const handleCreateCluster = () => {
    navigate('/create-cluster');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow pt-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isSignedIn) {
    navigate('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-3xl font-bold">Kubernetes Clusters</h1>
            
            <Button onClick={handleCreateCluster}>
              <Plus className="mr-2 h-4 w-4" /> Create Cluster
            </Button>
          </div>
          
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-subtle border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-1">Total Clusters</h3>
              <p className="text-3xl font-bold">{clusters.length}</p>
              <div className="mt-2 text-sm text-muted-foreground">
                {singleClusters.length} single, {multiClusters.length} multi
              </div>
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
                  <SelectItem value="multi">Multi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
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
                <div className="text-center py-12 border border-dashed rounded-lg">
                  <h3 className="text-lg font-medium mb-2">No clusters found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
                      ? 'No clusters match your current filters.' 
                      : 'Create your first cluster to get started.'}
                  </p>
                  {!(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                    <Button onClick={handleCreateCluster}>
                      <Plus className="mr-2 h-4 w-4" /> Create Cluster
                    </Button>
                  )}
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
                  <p className="text-muted-foreground">No single clusters found matching your filters.</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="multi" className="mt-6">
              {isLoading ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p>Loading clusters...</p>
                </div>
              ) : multiClusters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {multiClusters.map((cluster) => (
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
                  <p className="text-muted-foreground">No multi clusters found matching your filters.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
