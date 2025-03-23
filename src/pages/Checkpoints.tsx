import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CheckpointCard, { CheckpointStatus } from '@/components/checkpoints/CheckpointCard';
import CheckpointTimeline from '@/components/checkpoints/CheckpointTimeline';
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
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Plus, Search, Filter, Clock, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import BlurContainer from '@/components/ui/BlurContainer';
import { Skeleton } from '@/components/ui/skeleton';

const checkpoints = [
  {
    id: 'checkpoint-1',
    name: 'Database Migration',
    description: 'Migrating database configurations and persistent volumes',
    status: 'completed' as CheckpointStatus,
    progress: 100,
    lastUpdated: '2 days ago',
    clusterId: 'cluster-1',
    clusterName: 'Production DB'
  },
  {
    id: 'checkpoint-2',
    name: 'Network Configuration',
    description: 'Setting up network policies and service meshes',
    status: 'in-progress' as CheckpointStatus,
    progress: 65,
    lastUpdated: '3 hours ago',
    clusterId: 'cluster-2',
    clusterName: 'Staging Environment'
  },
  {
    id: 'checkpoint-3',
    name: 'Auth Services',
    description: 'Configuring authentication and security policies',
    status: 'pending' as CheckpointStatus,
    progress: 0,
    lastUpdated: 'Not started',
    clusterId: 'cluster-3',
    clusterName: 'Analytics Platform'
  },
  {
    id: 'checkpoint-4',
    name: 'Storage Migration',
    description: 'Transferring persistent volumes and storage classes',
    status: 'failed' as CheckpointStatus,
    progress: 38,
    lastUpdated: '1 day ago',
    clusterId: 'cluster-4',
    clusterName: 'Development'
  }
];

const timelineSteps = [
  {
    id: 'step-1',
    name: 'Resource Validation',
    description: 'Validating Kubernetes resources and dependencies',
    status: 'completed' as CheckpointStatus
  },
  {
    id: 'step-2',
    name: 'Configuration Export',
    description: 'Exporting configurations from source cluster',
    status: 'completed' as CheckpointStatus
  },
  {
    id: 'step-3',
    name: 'Target Preparation',
    description: 'Preparing target multi-cluster environment',
    status: 'in-progress' as CheckpointStatus
  },
  {
    id: 'step-4',
    name: 'Data Migration',
    description: 'Migrating stateful data and persistent volumes',
    status: 'pending' as CheckpointStatus
  },
  {
    id: 'step-5',
    name: 'Network Configuration',
    description: 'Setting up cross-cluster networking',
    status: 'pending' as CheckpointStatus
  },
  {
    id: 'step-6',
    name: 'Validation & Testing',
    description: 'Final validation and testing of migration',
    status: 'pending' as CheckpointStatus
  }
];

const Checkpoints = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  
  const filteredCheckpoints = checkpoints.filter(checkpoint => {
    const matchesSearch = checkpoint.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || checkpoint.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const activeCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'in-progress');
  const pendingCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'pending');
  const completedCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'completed');
  
  const handleCreateCheckpoint = () => {
    toast('Create new checkpoint functionality coming soon!');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <motion.h1 
              className="text-3xl font-bold"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              Migration Checkpoints
            </motion.h1>
            
            <Button onClick={handleCreateCheckpoint}>
              <Plus className="mr-2 h-4 w-4" /> Create Checkpoint
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <BlurContainer className="p-6">
                    <h3 className="text-lg font-medium mb-1">Total Checkpoints</h3>
                    <p className="text-3xl font-bold">{checkpoints.length}</p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Across all clusters
                    </div>
                  </BlurContainer>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <BlurContainer className="p-6">
                    <h3 className="text-lg font-medium mb-1">In Progress</h3>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-500">
                      {checkpoints.filter(c => c.status === 'in-progress').length}
                    </p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <Clock className="inline-block h-3 w-3 mr-1" /> Updated recently
                    </div>
                  </BlurContainer>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <BlurContainer className="p-6">
                    <h3 className="text-lg font-medium mb-1">Completed</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                      {checkpoints.filter(c => c.status === 'completed').length}
                    </p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Successfully migrated
                    </div>
                  </BlurContainer>
                </motion.div>
              </div>
              
              <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search checkpoints..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="all" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-6">
                  {filteredCheckpoints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredCheckpoints.map((checkpoint) => (
                        <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
                      ))}
                    </div>
                  ) : (
                    <BlurContainer className="p-10 text-center">
                      <p className="text-muted-foreground">No checkpoints found matching your filters.</p>
                    </BlurContainer>
                  )}
                </TabsContent>
                
                <TabsContent value="active" className="mt-6">
                  {activeCheckpoints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeCheckpoints.map((checkpoint) => (
                        <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
                      ))}
                    </div>
                  ) : (
                    <BlurContainer className="p-10 text-center">
                      <p className="text-muted-foreground">No active checkpoints found.</p>
                    </BlurContainer>
                  )}
                </TabsContent>
                
                <TabsContent value="pending" className="mt-6">
                  {pendingCheckpoints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pendingCheckpoints.map((checkpoint) => (
                        <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
                      ))}
                    </div>
                  ) : (
                    <BlurContainer className="p-10 text-center">
                      <p className="text-muted-foreground">No pending checkpoints found.</p>
                    </BlurContainer>
                  )}
                </TabsContent>
                
                <TabsContent value="completed" className="mt-6">
                  {completedCheckpoints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {completedCheckpoints.map((checkpoint) => (
                        <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
                      ))}
                    </div>
                  ) : (
                    <BlurContainer className="p-10 text-center">
                      <p className="text-muted-foreground">No completed checkpoints found.</p>
                    </BlurContainer>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            <div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="sticky top-24">
                  <CardContent className="pt-6">
                    <h3 className="text-xl font-bold mb-4">Migration Timeline</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Standard migration process from single to multi-cluster architecture
                    </p>
                    
                    <CheckpointTimeline 
                      steps={timelineSteps}
                      currentStepId="step-3"
                    />
                    
                    <div className="mt-8">
                      <Button className="w-full">
                        Start New Migration <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
          
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[400px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <BlurContainer className="p-6">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Network Configuration checkpoint updated</p>
                      <p className="text-sm text-muted-foreground">Progress advanced to 65%</p>
                      <p className="text-xs text-muted-foreground mt-1">3 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Database Migration checkpoint completed</p>
                      <p className="text-sm text-muted-foreground">All resources successfully migrated</p>
                      <p className="text-xs text-muted-foreground mt-1">2 days ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded-full">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium">Storage Migration checkpoint failed</p>
                      <p className="text-sm text-muted-foreground">Error during persistent volume migration</p>
                      <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
              </BlurContainer>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Checkpoints;
