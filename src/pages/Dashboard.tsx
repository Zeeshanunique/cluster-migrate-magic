
import { useState } from 'react';
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
import { Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

// Mock data
const clusters = [
  {
    id: 'cluster-1',
    name: 'Production DB',
    type: 'single' as const,
    status: 'running' as const,
    nodes: 3,
    region: 'us-west-1',
    version: 'v1.24.6',
    lastUpdated: '1 day ago'
  },
  {
    id: 'cluster-2',
    name: 'Staging Environment',
    type: 'single' as const,
    status: 'running' as const,
    nodes: 2,
    region: 'eu-central-1',
    version: 'v1.25.0',
    lastUpdated: '3 days ago'
  },
  {
    id: 'cluster-3',
    name: 'Analytics Platform',
    type: 'multi' as const,
    status: 'running' as const,
    nodes: 5,
    region: 'us-east-1',
    version: 'v1.24.8',
    lastUpdated: '5 hours ago'
  },
  {
    id: 'cluster-4',
    name: 'Development',
    type: 'single' as const,
    status: 'pending' as const,
    nodes: 1,
    region: 'ap-southeast-1',
    version: 'v1.24.9',
    lastUpdated: 'Just now'
  }
];

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
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
    toast('Create new cluster functionality coming soon!');
  };

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
              {filteredClusters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClusters.map((cluster) => (
                    <ClusterCard key={cluster.id} cluster={cluster} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No clusters found matching your filters.</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="single" className="mt-6">
              {singleClusters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {singleClusters.map((cluster) => (
                    <ClusterCard key={cluster.id} cluster={cluster} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No single clusters found matching your filters.</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="multi" className="mt-6">
              {multiClusters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {multiClusters.map((cluster) => (
                    <ClusterCard key={cluster.id} cluster={cluster} />
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
