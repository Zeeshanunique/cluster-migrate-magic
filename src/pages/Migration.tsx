import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { 
  ChevronLeft, 
  ArrowRight, 
  ClipboardList, 
  Wand2, 
  HelpCircle,
  AlertCircle,
  FileDown,
  Loader2,
  Cloud,
  Server
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MigrationWizard from '@/components/clusters/MigrationWizard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/supabase';
import { toast } from 'sonner';
import MigrationService, { ResourceToMigrate } from '@/services/MigrationService';

const Migration = () => {
  const [searchParams] = useSearchParams();
  const sourceClusterId = searchParams.get('sourceCluster') || '';
  const targetClusterId = searchParams.get('targetCluster') || '';
  const autostart = searchParams.get('autostart') === 'true';
  const mode = searchParams.get('mode') || 'wizard';
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Available clusters
  const [availableSingleClusters, setAvailableSingleClusters] = useState<Cluster[]>([]);
  const [availableMultiClusters, setAvailableMultiClusters] = useState<Cluster[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>(mode === 'direct' ? 'direct' : 'wizard');
  
  // Direct migration states
  const [sourceCluster, setSourceCluster] = useState<Cluster | null>(null);
  const [targetCluster, setTargetCluster] = useState<Cluster | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string>('idle');
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<number>(0);
  
  // Simulate smooth scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Load available clusters
  useEffect(() => {
    const loadClusters = async () => {
      if (!user) return;
      
      setLoadingClusters(true);
      
      try {
        const clusters = await clusterService.getAllClusters(user.id);
        const singleClusters = clusters.filter(c => c.type === 'single');
        const multiTenantClusters = clusters.filter(c => c.type === 'tenant');
        
        setAvailableSingleClusters(singleClusters);
        setAvailableMultiClusters(multiTenantClusters);
        
        // If IDs were provided in URL, pre-select those clusters
        if (sourceClusterId) {
          const selectedSource = singleClusters.find(c => c.id === sourceClusterId);
          if (selectedSource) {
            setSourceCluster(selectedSource);
          }
        }
        
        if (targetClusterId) {
          const selectedTarget = multiTenantClusters.find(c => c.id === targetClusterId);
          if (selectedTarget) {
            setTargetCluster(selectedTarget);
          }
        }
        
        // If the user doesn't have the required clusters, show a notification
        if (singleClusters.length === 0) {
          toast.warning('You need at least one single cluster to perform migration');
        }
        
        if (multiTenantClusters.length === 0) {
          toast.warning('You need at least one multi-tenant cluster to perform migration');
        }
      } catch (error) {
        console.error('Error loading clusters:', error);
        toast.error('Failed to load clusters. Please try again later.');
      } finally {
        setLoadingClusters(false);
      }
    };
    
    loadClusters();
  }, [user, sourceClusterId, targetClusterId]);
  
  // Direct migration function
  const startDirectMigration = async () => {
    if (!sourceCluster || !targetCluster) {
      toast.error('Please select both source and target clusters');
      return;
    }
    
    if (!sourceCluster.kubeconfig || !targetCluster.kubeconfig) {
      toast.error('Missing kubeconfig for one of the clusters');
      return;
    }
    
    setMigrationStatus('starting');
    setMigrationError(null);
    
    try {
      // First fetch all deployments from the source cluster to migrate
      setMigrationStatus('fetching');
      
      // In a real implementation, we would fetch the actual resources here
      // For now, we'll create a sample list of resources to migrate
      const resourcesToMigrate: ResourceToMigrate[] = [
        // Use commonly deployed resources
        { kind: 'Deployment', name: 'nginx', namespace: 'default' },
        { kind: 'Service', name: 'nginx', namespace: 'default' },
        { kind: 'ConfigMap', name: 'app-config', namespace: 'default' },
        { kind: 'Secret', name: 'app-secrets', namespace: 'default' }
      ];
      
      // Start the migration process
      setMigrationStatus('migrating');
      
      // Pass the migration to the service
      const id = await MigrationService.migrateResources(
        sourceCluster.kubeconfig,
        targetCluster.kubeconfig,
        resourcesToMigrate,
        {
          targetNamespace: 'default',
          migrateVolumes: false,
          preserveNodeAffinity: false
        }
      );
      
      setMigrationId(id);
      
      // Start polling for migration status
      const statusInterval = setInterval(async () => {
        try {
          const status = await MigrationService.getMigrationStatus(id);
          
          // Update progress
          if (status.resourcesTotal > 0) {
            const progressPercentage = Math.floor((status.resourcesMigrated / status.resourcesTotal) * 100);
            setMigrationProgress(progressPercentage);
          }
          
          // Check if migration is completed or failed
          if (status.status === 'completed') {
            clearInterval(statusInterval);
            setMigrationStatus('completed');
            toast.success('Migration completed successfully');
          } else if (status.status === 'failed') {
            clearInterval(statusInterval);
            setMigrationStatus('failed');
            setMigrationError(status.error || 'Unknown error');
            toast.error(`Migration failed: ${status.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error checking migration status:', error);
        }
      }, 2000);
      
      // Cleanup function
      return () => clearInterval(statusInterval);
    } catch (error: any) {
      setMigrationStatus('failed');
      setMigrationError(error.message || 'Unknown error');
      toast.error(`Failed to start migration: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Check if direct migration should start automatically
  useEffect(() => {
    if (autostart && sourceCluster && targetCluster && selectedTab === 'direct' && migrationStatus === 'idle') {
      startDirectMigration();
    }
  }, [autostart, sourceCluster, targetCluster, selectedTab, migrationStatus]);
  
  // Render direct migration UI
  const renderDirectMigration = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Direct Migration</CardTitle>
            <CardDescription>
              Quickly migrate resources between clusters without the step-by-step wizard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Source Cluster (Single)</label>
                <select 
                  className="w-full border border-input bg-background px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  value={sourceCluster?.id || ''}
                  onChange={e => {
                    const selected = availableSingleClusters.find(c => c.id === e.target.value);
                    setSourceCluster(selected || null);
                  }}
                  disabled={migrationStatus !== 'idle'}
                >
                  <option value="">Select a source cluster...</option>
                  {availableSingleClusters.map(cluster => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.region})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Target Cluster (Multi-Tenant)</label>
                <select 
                  className="w-full border border-input bg-background px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  value={targetCluster?.id || ''}
                  onChange={e => {
                    const selected = availableMultiClusters.find(c => c.id === e.target.value);
                    setTargetCluster(selected || null);
                  }}
                  disabled={migrationStatus !== 'idle'}
                >
                  <option value="">Select a target cluster...</option>
                  {availableMultiClusters.map(cluster => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.region})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {migrationStatus !== 'idle' && migrationStatus !== 'completed' && migrationStatus !== 'failed' && (
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Migration Progress</span>
                  <span className="text-sm font-medium">{migrationProgress}%</span>
                </div>
                <div className="w-full bg-muted-foreground/20 rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full" 
                    style={{ width: `${migrationProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {migrationStatus === 'starting' && 'Initializing migration...'}
                  {migrationStatus === 'fetching' && 'Fetching resources from source cluster...'}
                  {migrationStatus === 'migrating' && 'Migrating resources to target cluster...'}
                </p>
              </div>
            )}
            
            {migrationStatus === 'completed' && (
              <Alert className="bg-green-50 dark:bg-green-950/30 border-green-500 text-green-800 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Migration Successful</AlertTitle>
                <AlertDescription>
                  Resources have been successfully migrated from {sourceCluster?.name} to {targetCluster?.name}.
                </AlertDescription>
              </Alert>
            )}
            
            {migrationStatus === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Migration Failed</AlertTitle>
                <AlertDescription>
                  {migrationError || 'An unknown error occurred during migration'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={migrationStatus !== 'idle' && migrationStatus !== 'completed' && migrationStatus !== 'failed'}
            >
              Cancel
            </Button>
            
            {migrationStatus === 'idle' && (
              <Button 
                onClick={startDirectMigration}
                disabled={!sourceCluster || !targetCluster || migrationStatus !== 'idle'}
              >
                Start Migration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            
            {(migrationStatus === 'starting' || migrationStatus === 'fetching' || migrationStatus === 'migrating') && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </Button>
            )}
            
            {migrationStatus === 'completed' && (
              <Button onClick={() => navigate(`/cluster/${targetCluster?.id}`)}>
                View Target Cluster
              </Button>
            )}
            
            {migrationStatus === 'failed' && (
              <Button 
                variant="destructive"
                onClick={() => {
                  setMigrationStatus('idle');
                  setMigrationError(null);
                  setMigrationProgress(0);
                }}
              >
                Retry
              </Button>
            )}
          </CardFooter>
        </Card>
        
        <Alert>
          <HelpCircle className="h-4 w-4" />
          <AlertTitle>Direct Migration vs. Wizard</AlertTitle>
          <AlertDescription>
            Direct migration automatically selects common resources to migrate. For more control over
            the migration process, use the Wizard tab which provides a step-by-step interface.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  // Helper components
  const CheckCircle = ({ className }: { className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="flex items-center mb-6">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          
          <div className="max-w-5xl mx-auto mb-10">
            <h1 className="text-3xl font-bold text-center mb-2">Cluster Migration</h1>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto">
              Migrate your Kubernetes resources from a single cluster to a multi-tenant environment
              with proper namespace isolation and resource management.
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <Tabs 
              defaultValue={selectedTab} 
              onValueChange={setSelectedTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="wizard" className="flex items-center justify-center">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Migration Wizard
                </TabsTrigger>
                <TabsTrigger value="direct" className="flex items-center justify-center">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Direct Migration
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="wizard" className="mt-0">
                <MigrationWizard />
              </TabsContent>
              
              <TabsContent value="direct" className="mt-0">
                {renderDirectMigration()}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Migration;
