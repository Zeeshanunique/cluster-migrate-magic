import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
import { Calendar, Plus, Search, Filter, Clock, ArrowRight, CheckCircle, AlertTriangle, DatabaseZap, X, Database } from 'lucide-react';
import { toast } from 'sonner';
import BlurContainer from '@/components/ui/BlurContainer';
import { Skeleton } from '@/components/ui/skeleton';
import { checkpointService, Checkpoint, clusterService } from '@/utils/dynamodb';

// Sample timeline data
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [showMockNotice, setShowMockNotice] = useState(true);
  
  // Fetch checkpoints from the database
  useEffect(() => {
    const fetchCheckpoints = async () => {
      if (user) {
        setIsLoading(true);
        setError(null);
        try {
          const data = await checkpointService.getAllCheckpoints(user.id);
          setCheckpoints(data);
          
          // Check if the first checkpoint ID starts with 'mock-' to determine if using mock data
          if (data.length > 0 && data[0].id.startsWith('mock-')) {
            setUsingMockData(true);
          }
        } catch (error) {
          console.error('Error fetching checkpoints:', error);
          setError('Failed to load checkpoints. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchCheckpoints();
  }, [user]);
  
  const filteredCheckpoints = checkpoints.filter(checkpoint => {
    const matchesSearch = checkpoint.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || checkpoint.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const activeCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'in-progress');
  const pendingCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'pending');
  const completedCheckpoints = filteredCheckpoints.filter(cp => cp.status === 'completed');
  
  const handleCreateCheckpoint = async () => {
    if (!user) {
      toast.error('You must be signed in to create a checkpoint');
      return;
    }
    
    // Get user's clusters to select from
    try {
      const clusters = await clusterService.getAllClusters(user.id);
      
      if (!clusters || clusters.length === 0) {
        toast.error('You need to create a cluster first');
        navigate('/create-cluster');
        return;
      }
      
      // In a real application, this would open a modal to select a cluster and configure the checkpoint
      toast('Create new checkpoint functionality coming soon!');
      
      // Example of how you would create a checkpoint
      // const newCheckpoint = {
      //   name: 'New Migration Checkpoint',
      //   description: 'Migration checkpoint for cluster resources',
      //   clusterId: clusters[0].id
      // };
      // const result = await checkpointService.createCheckpoint(newCheckpoint, user.id);
      // if (result) {
      //   setCheckpoints([...checkpoints, result]);
      //   toast.success('Checkpoint created successfully');
      // }
    } catch (error) {
      console.error('Error preparing to create checkpoint:', error);
      toast.error('Failed to prepare checkpoint creation');
    }
  };
  
  const handleDeleteCheckpoint = async (checkpointId: string) => {
    if (window.confirm('Are you sure you want to delete this checkpoint?')) {
      setIsLoading(true);
      try {
        const success = await checkpointService.deleteCheckpoint(checkpointId);
        if (success) {
          setCheckpoints(prev => prev.filter(cp => cp.id !== checkpointId));
          toast.success('Checkpoint deleted successfully');
        }
      } catch (error) {
        console.error('Error deleting checkpoint:', error);
        toast.error('Failed to delete checkpoint');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleRestartCheckpoint = async (checkpointId: string) => {
    setIsLoading(true);
    try {
      const success = await checkpointService.updateCheckpoint(checkpointId, {
        status: 'in-progress',
        progress: 10
      });
      
      if (success) {
        setCheckpoints(prev => prev.map(cp => 
          cp.id === checkpointId ? { ...cp, status: 'in-progress' as CheckpointStatus, progress: 10 } : cp
        ));
        toast.success('Checkpoint restarted');
      }
    } catch (error) {
      console.error('Error restarting checkpoint:', error);
      toast.error('Failed to restart checkpoint');
    } finally {
      setIsLoading(false);
    }
  };

  // Display a full-page error state if there's a critical error
  if (error && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow pt-20 flex items-center justify-center">
          <BlurContainer className="text-center p-8 max-w-md">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Error Loading Checkpoints</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </BlurContainer>
        </main>
        <Footer />
      </div>
    );
  }

  // Render empty state when there are no checkpoints
  const renderEmptyState = () => (
    <BlurContainer className="p-12 text-center">
      <DatabaseZap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-medium mb-2">No Checkpoints Found</h3>
      <p className="text-muted-foreground mb-6">
        You haven't created any migration checkpoints yet.
      </p>
      <Button onClick={handleCreateCheckpoint}>
        <Plus className="mr-2 h-4 w-4" /> Create Your First Checkpoint
      </Button>
    </BlurContainer>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        {usingMockData && showMockNotice && (
          <div className="bg-amber-100 dark:bg-amber-900/50 border-l-4 border-amber-500 p-4 mx-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex">
                <Database className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Using Demo Data</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The checkpoints table doesn't exist in your Supabase database. 
                    <a 
                      href="https://github.com/yourusername/kubemigrate/blob/main/docs/setup/database.md" 
                      target="_blank" 
                      rel="noreferrer"
                      className="underline hover:text-amber-900 dark:hover:text-amber-100 ml-1"
                    >
                      Click here to view setup instructions
                    </a>.
                  </p>
                </div>
              </div>
              <button 
                className="text-amber-500 hover:text-amber-800 dark:hover:text-amber-200"
                onClick={() => setShowMockNotice(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        
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
          
          {!isLoading && checkpoints.length === 0 ? (
            // Show the all-encompassing empty state when there are no checkpoints
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {renderEmptyState()}
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
                        currentStepId="step-1"
                      />
                      
                      <div className="mt-8">
                        <Button className="w-full" onClick={handleCreateCheckpoint}>
                          Start New Migration <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          ) : (
            // Show the regular UI with filters and tabs when there are checkpoints or loading
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
                    {isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                          <BlurContainer key={i} className="p-6 h-[280px]">
                            <div className="flex justify-between mb-4">
                              <Skeleton className="h-6 w-[150px]" />
                              <Skeleton className="h-6 w-[80px]" />
                            </div>
                            <Skeleton className="h-4 w-full mb-6" />
                            <Skeleton className="h-4 w-full mb-1" />
                            <Skeleton className="h-2 w-full mb-6" />
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div>
                                <Skeleton className="h-4 w-[60px] mb-1" />
                                <Skeleton className="h-4 w-[100px]" />
                              </div>
                              <div>
                                <Skeleton className="h-4 w-[60px] mb-1" />
                                <Skeleton className="h-4 w-[100px]" />
                              </div>
                            </div>
                            <Skeleton className="h-9 w-full" />
                          </BlurContainer>
                        ))}
                      </div>
                    ) : filteredCheckpoints.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredCheckpoints.map((checkpoint) => (
                          <CheckpointCard 
                            key={checkpoint.id} 
                            checkpoint={checkpoint} 
                            onDelete={handleDeleteCheckpoint}
                            onRestart={handleRestartCheckpoint}
                          />
                        ))}
                      </div>
                    ) : (
                      <BlurContainer className="p-10 text-center">
                        <p className="text-muted-foreground">No checkpoints found matching your filters.</p>
                      </BlurContainer>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="active" className="mt-6">
                    {isLoading ? (
                      <BlurContainer className="p-6 h-[200px] flex items-center justify-center">
                        <Skeleton className="h-8 w-[200px]" />
                      </BlurContainer>
                    ) : activeCheckpoints.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activeCheckpoints.map((checkpoint) => (
                          <CheckpointCard 
                            key={checkpoint.id} 
                            checkpoint={checkpoint} 
                            onDelete={handleDeleteCheckpoint}
                            onRestart={handleRestartCheckpoint}
                          />
                        ))}
                      </div>
                    ) : (
                      <BlurContainer className="p-10 text-center">
                        <p className="text-muted-foreground">No active checkpoints found.</p>
                      </BlurContainer>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="pending" className="mt-6">
                    {isLoading ? (
                      <BlurContainer className="p-6 h-[200px] flex items-center justify-center">
                        <Skeleton className="h-8 w-[200px]" />
                      </BlurContainer>
                    ) : pendingCheckpoints.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pendingCheckpoints.map((checkpoint) => (
                          <CheckpointCard 
                            key={checkpoint.id} 
                            checkpoint={checkpoint} 
                            onDelete={handleDeleteCheckpoint}
                            onRestart={handleRestartCheckpoint}
                          />
                        ))}
                      </div>
                    ) : (
                      <BlurContainer className="p-10 text-center">
                        <p className="text-muted-foreground">No pending checkpoints found.</p>
                      </BlurContainer>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-6">
                    {isLoading ? (
                      <BlurContainer className="p-6 h-[200px] flex items-center justify-center">
                        <Skeleton className="h-8 w-[200px]" />
                      </BlurContainer>
                    ) : completedCheckpoints.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {completedCheckpoints.map((checkpoint) => (
                          <CheckpointCard 
                            key={checkpoint.id} 
                            checkpoint={checkpoint} 
                            onDelete={handleDeleteCheckpoint}
                            onRestart={handleRestartCheckpoint}
                          />
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
                        <Button className="w-full" onClick={handleCreateCheckpoint}>
                          Start New Migration <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          )}
          
          {/* Activity section - would be implemented with a real activity log in production */}
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
                  {/* Sample activity items */}
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
