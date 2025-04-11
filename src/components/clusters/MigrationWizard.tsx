import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Check, 
  ChevronRight, 
  AlertCircle, 
  Loader2,
  Cloud,
  Database,
  Server,
  Shield,
  ChevronsUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import BlurContainer from '@/components/ui/BlurContainer';
import { toast } from 'sonner';
import AWSClusterConfig from './AWSClusterConfig';
import ResourceInventory from './ResourceInventory';
import CompatibilityCheck from './CompatibilityCheck';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/supabase';
import { 
  EKSClusterConfig, 
  EKSNodeInfo, 
  EKSPodInfo, 
  EKSPVInfo, 
  connectToEKSCluster, 
  getEKSNodes, 
  getEKSPods, 
  getEKSPVs,
  migrateResources,
  checkClusterCompatibility,
  generateKubeconfig
} from '@/utils/aws';

const steps = [
  { 
    id: 'connect', 
    title: 'Connect to AWS EKS Clusters', 
    description: 'Connect to source and target EKS clusters',
    icon: <Cloud className="h-4 w-4" />
  },
  { 
    id: 'inventory', 
    title: 'Resource Inventory', 
    description: 'View and select resources to migrate',
    icon: <Database className="h-4 w-4" />
  },
  { 
    id: 'compatibility', 
    title: 'Compatibility Check', 
    description: 'Verify clusters are compatible for migration',
    icon: <Server className="h-4 w-4" />
  },
  { 
    id: 'migration', 
    title: 'Migration Execution', 
    description: 'Migrate selected resources to target cluster',
    icon: <Shield className="h-4 w-4" />
  },
  { 
    id: 'verify', 
    title: 'Verify Migration', 
    description: 'Verify all resources are properly migrated',
    icon: <Check className="h-4 w-4" />
  },
];

const MigrationWizard = () => {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('cluster') || '';
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Available clusters
  const [availableSingleClusters, setAvailableSingleClusters] = useState<Cluster[]>([]);
  const [availableMultiClusters, setAvailableMultiClusters] = useState<Cluster[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(false);
  
  // Source cluster data
  const [sourceCluster, setSourceCluster] = useState<Cluster | null>(null);
  const [targetCluster, setTargetCluster] = useState<Cluster | null>(null);
  
  // AWS EKS specific configuration
  const [sourceConfig, setSourceConfig] = useState<EKSClusterConfig>({
    clusterName: clusterId || '',
    region: 'us-east-1',
    useIAMRole: false,
  });
  
  const [targetConfig, setTargetConfig] = useState<EKSClusterConfig>({
    clusterName: '',
    region: 'us-east-1',
    useIAMRole: false,
  });

  // Resource data states
  const [sourceConnected, setSourceConnected] = useState(false);
  const [targetConnected, setTargetConnected] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [nodes, setNodes] = useState<EKSNodeInfo[]>([]);
  const [pods, setPods] = useState<EKSPodInfo[]>([]);
  const [persistentVolumes, setPersistentVolumes] = useState<EKSPVInfo[]>([]);

  // Compatibility check states
  const [checkingCompatibility, setCheckingCompatibility] = useState(false);
  const [compatibility, setCompatibility] = useState<{ compatible: boolean; issues: string[] }>({
    compatible: false,
    issues: [],
  });

  // Migration progress state
  const [migrationProgress, setMigrationProgress] = useState({ step: 0, message: '' });

  // Load available clusters on component mount
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
        
        // If a cluster ID was provided in the URL, select it as the source
        if (clusterId) {
          const selectedCluster = singleClusters.find(c => c.id === clusterId);
          if (selectedCluster) {
            handleSourceClusterSelect(selectedCluster.id);
          }
        } else if (singleClusters.length > 0) {
          // Auto-select the first single cluster as source if none specified
          handleSourceClusterSelect(singleClusters[0].id);
        }
        
        // Auto-select the first multi-tenant cluster as target if available
        if (multiTenantClusters.length > 0) {
          handleTargetClusterSelect(multiTenantClusters[0].id);
        }
      } catch (error) {
        console.error('Error loading clusters:', error);
        setError('Failed to load available clusters');
      } finally {
        setLoadingClusters(false);
      }
    };
    
    loadClusters();
  }, [user, clusterId]);

  // Handle source cluster selection
  const handleSourceClusterSelect = async (clusterId: string) => {
    const cluster = availableSingleClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    
    setSourceCluster(cluster);
    setSourceConfig({
      clusterName: cluster.name,
      region: cluster.region || 'us-east-1',
      kubeconfig: cluster.kubeconfig,
      useIAMRole: !cluster.kubeconfig
    });
  };
  
  // Handle target cluster selection
  const handleTargetClusterSelect = async (clusterId: string) => {
    const cluster = availableMultiClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    
    setTargetCluster(cluster);
    setTargetConfig({
      clusterName: cluster.name,
      region: cluster.region || 'us-east-1',
      kubeconfig: cluster.kubeconfig,
      useIAMRole: !cluster.kubeconfig
    });
  };

  // Connect to clusters
  const connectToClusters = async () => {
    // Validate inputs
    if (!sourceConfig.clusterName) {
      toast.error("Source cluster name is required");
      return;
    }
    
    if (!targetConfig.clusterName) {
      toast.error("Target cluster name is required");
      return;
    }

    // Check if kubeconfig or IAM role is provided for both clusters
    if (!sourceConfig.kubeconfig && !sourceConfig.useIAMRole) {
      toast.error("Please provide a kubeconfig or enable IAM role for the source cluster");
      return;
    }

    if (!targetConfig.kubeconfig && !targetConfig.useIAMRole) {
      toast.error("Please provide a kubeconfig or enable IAM role for the target cluster");
      return;
    }

    setStatus('running');
    
    // Connect to source cluster
    const sourceConnected = await connectToEKSCluster(sourceConfig);
    setSourceConnected(sourceConnected);
    
    if (!sourceConnected) {
      setStatus('error');
      setError("Failed to connect to source cluster");
      return;
    }
    
    // Connect to target cluster
    const targetConnected = await connectToEKSCluster(targetConfig);
    setTargetConnected(targetConnected);
    
    if (!targetConnected) {
      setStatus('error');
      setError("Failed to connect to target cluster");
      return;
    }
    
    // If both connections are successful, advance to the next step
    toast.success("Connected to both clusters successfully");
    setCurrentStep(1);
    setProgress(((currentStep + 2) / steps.length) * 100);
    setStatus('idle');
  };

  // Load resources from source cluster
  const loadResources = async () => {
    if (!sourceConnected) {
      toast.error("Please connect to the source cluster first");
      return;
    }

    setLoadingResources(true);
    setStatus('running');

    try {
      // Fetch nodes, pods, and persistent volumes in parallel
      const [nodesData, podsData, pvsData] = await Promise.all([
        getEKSNodes(sourceConfig),
        getEKSPods(sourceConfig),
        getEKSPVs(sourceConfig)
      ]);

      setNodes(nodesData);
      setPods(podsData);
      setPersistentVolumes(pvsData);

      toast.success("Resources loaded successfully");
      setStatus('idle');
    } catch (error) {
      console.error("Failed to load resources:", error);
      setStatus('error');
      setError(`Failed to load resources: ${(error as Error).message}`);
    } finally {
      setLoadingResources(false);
    }
  };

  // Handle pod selection change
  const handlePodSelectionChange = (pod: EKSPodInfo, selected: boolean) => {
    setPods(prevPods => 
      prevPods.map(p => 
        p.name === pod.name ? { ...p, selected } : p
      )
    );
  };

  // Handle persistent volume selection change
  const handlePVSelectionChange = (pv: EKSPVInfo, selected: boolean) => {
    setPersistentVolumes(prevPVs => 
      prevPVs.map(p => 
        p.name === pv.name ? { ...p, selected } : p
      )
    );
  };

  // Handle select all functionality
  const handleSelectAll = (resourceType: 'pods' | 'pvs', selectAll: boolean) => {
    if (resourceType === 'pods') {
      setPods(prevPods => prevPods.map(pod => ({ ...pod, selected: selectAll })));
    } else {
      setPersistentVolumes(prevPVs => prevPVs.map(pv => ({ ...pv, selected: selectAll })));
    }
  };

  // Proceed to compatibility check
  const proceedToCompatibilityCheck = async () => {
    // Check if any resources are selected
    const selectedPods = pods.filter(pod => pod.selected).length;
    const selectedPVs = persistentVolumes.filter(pv => pv.selected).length;
    
    if (selectedPods === 0 && selectedPVs === 0) {
      toast.error("Please select at least one resource to migrate");
      return;
    }
    
    setCheckingCompatibility(true);
    setStatus('running');
    
    try {
      // Check compatibility between clusters
      const compatibilityResult = await checkClusterCompatibility(sourceConfig, targetConfig);
      setCompatibility(compatibilityResult);
      
      // Move to next step
      setCurrentStep(currentStep + 1);
      setProgress(((currentStep + 2) / steps.length) * 100);
      setStatus('idle');
    } catch (error) {
      console.error("Compatibility check failed:", error);
      setStatus('error');
      setError(`Compatibility check failed: ${(error as Error).message}`);
    } finally {
      setCheckingCompatibility(false);
    }
  };

  // Start migration process
  const startMigration = async () => {
    if (!sourceConnected || !targetConnected) {
      toast.error("Please ensure both clusters are connected");
      return;
    }
    
    setStatus('running');
    
    try {
      // Prevent duplicate migration if source is already a multi-tenant
      if (sourceCluster?.type === 'tenant') {
        toast.warning(`Cluster "${sourceCluster.name}" is already a multi-tenant`);
        setStatus('error');
        setError("Source cluster is already a multi-tenant");
        return;
      }
      
      // Get selected resources
    const selectedPods = pods.filter(pod => pod.selected);
    const selectedPVs = persistentVolumes.filter(pv => pv.selected);
    
      if (selectedPods.length === 0 && selectedPVs.length === 0) {
        toast.warning("No resources selected for migration");
        setStatus('error');
        setError("Please select at least one resource to migrate");
        return;
      }
      
      // Generate a kubeconfig for the target cluster
      let targetKubeconfig = targetConfig.kubeconfig;
      if (!targetKubeconfig && targetConfig.clusterName) {
        try {
          targetKubeconfig = await generateKubeconfig(targetConfig);
        } catch (error) {
          console.error("Failed to generate kubeconfig:", error);
          setStatus('error');
          setError(`Failed to generate kubeconfig: ${(error as Error).message}`);
          return;
        }
      }
      
      // Execute migration
      setMigrationProgress({ step: 0, message: "Starting migration process..." });
      
      const migrationSuccessful = await migrateResources(
        sourceConfig,
        targetConfig,
        selectedPods,
        selectedPVs,
        (step, message) => {
          setMigrationProgress({ step, message });
        }
      );
      
      if (migrationSuccessful) {
        // Update the source cluster in Supabase
        if (sourceCluster && user?.id) {
          setMigrationProgress({ 
            step: 4, 
            message: "Migration successful. Updating database records..." 
          });
          
          const success = await clusterService.convertToMultiTenant(sourceCluster.id, {
            name: sourceCluster.name, // Keep original name
            region: targetConfig.region, // Use target region
            nodes: sourceCluster.nodes + (nodes.length || 1), // Add nodes from source
            aws_account_id: targetConfig.clusterName.includes('aws') ? 
              `${Math.floor(Math.random() * 1000000000000)}` : undefined,
            aws_role_arn: targetConfig.useIAMRole ? 
              `arn:aws:iam::${Math.floor(Math.random() * 1000000000000)}:role/EKSClusterRole` : undefined,
            kubeconfig: targetKubeconfig
          });
          
          if (!success) {
            // Migration completed but database update failed
            setMigrationProgress({ 
              step: 5, 
              message: "Warning: Resources migrated but database update failed. Manual verification needed." 
            });
            toast.warning("Migration completed but database update failed. Please verify cluster status.");
          } else {
            // Migration and database update successful
            setMigrationProgress({ 
              step: 5, 
              message: "Migration complete! Database records updated successfully." 
            });
          }
        }
        
        // Advance to verification step
        setCurrentStep(currentStep + 1);
        setProgress(100);
        setStatus('completed');
        toast.success("Migration completed successfully!");
      } else {
        setStatus('error');
        setError("Migration failed - unable to transfer resources");
      }
    } catch (error) {
      console.error("Migration failed:", error);
      setStatus('error');
      setError(`Migration failed: ${(error as Error).message}`);
    }
  };

  // Reset migration process
  const resetMigration = () => {
    // Reset all state variables
    setCurrentStep(0);
    setProgress(0);
    setStatus('idle');
    setError(null);
    setSourceConnected(false);
    setTargetConnected(false);
    setNodes([]);
    setPods([]);
    setPersistentVolumes([]);
    setCompatibility({ compatible: false, issues: [] });
    setMigrationProgress({ step: 0, message: '' });
  };
  
  // Finish migration and navigate back to dashboard
  const finishMigration = () => {
    // First ensure the cluster is updated properly in Supabase
    if (sourceCluster && status === 'completed') {
      // Force a refresh of the dashboard by navigating with a timestamp parameter
      // This ensures the dashboard will reload cluster data from Supabase
      toast.success("Migration completed and saved. Redirecting to dashboard...");
      navigate('/dashboard?refresh=' + Date.now());
    } else if (status === 'error') {
      // If there was an error, we'll go to the dashboard anyway
      toast.error("Migration had errors - please check your cluster status");
      navigate('/dashboard');
    } else {
    navigate('/dashboard');
    }
  };

  // Render appropriate content for current step
  const renderStepContent = () => {
    switch(currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Source Cluster Configuration</CardTitle>
                <CardDescription>
                  Select a single cluster as your migration source
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingClusters ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span>Loading clusters...</span>
                  </div>
                ) : availableSingleClusters.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No single clusters available for migration</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/create-cluster')}
                    >
                      Create Single Cluster
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="source-cluster">Select Source Cluster</Label>
                      <Select 
                        value={sourceCluster?.id || ''} 
                        onValueChange={handleSourceClusterSelect}
                        disabled={sourceConnected}
                      >
                        <SelectTrigger id="source-cluster" className="w-full">
                          <SelectValue placeholder="Select a single cluster" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSingleClusters.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                              {cluster.name} ({cluster.region}) - {cluster.nodes} node(s)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  
                    {sourceCluster && (
            <AWSClusterConfig
              config={sourceConfig}
              onChange={setSourceConfig}
                        title="Source Cluster"
                        readOnly={sourceConnected}
                        clusterData={sourceCluster}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Target Cluster Configuration</CardTitle>
                <CardDescription>
                  Select a multi-tenant as your migration target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingClusters ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span>Loading clusters...</span>
                  </div>
                ) : availableMultiClusters.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No multi-tenant clusters available as target</p>
                    <p className="text-sm text-muted-foreground mb-4">You need at least one multi-tenant cluster for migration.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/create-cluster')}
                    >
                      Create Multi-Tenant Cluster
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="target-cluster">Select Target Cluster</Label>
                      <Select 
                        value={targetCluster?.id || ''} 
                        onValueChange={handleTargetClusterSelect}
                        disabled={targetConnected}
                      >
                        <SelectTrigger id="target-cluster" className="w-full">
                          <SelectValue placeholder="Select a multi-tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMultiClusters.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                              {cluster.name} ({cluster.region}) - {cluster.nodes} node(s)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {targetCluster && (
            <AWSClusterConfig
              config={targetConfig}
              onChange={setTargetConfig}
                        title="Target Cluster"
                        readOnly={targetConnected}
                        clusterData={targetCluster}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 1:
        return (
          <div className="space-y-6 py-4">
            <ResourceInventory
              pods={pods}
              persistentVolumes={persistentVolumes}
              nodes={nodes}
              onPodSelectionChange={handlePodSelectionChange}
              onPVSelectionChange={handlePVSelectionChange}
              onSelectAll={handleSelectAll}
              loadResources={loadResources}
              isLoading={loadingResources}
            />
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
                </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6 py-4">
            <CompatibilityCheck
              sourceConfig={sourceConfig}
              targetConfig={targetConfig}
              compatibilityResult={compatibility}
            />
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
            </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Migration Progress</CardTitle>
                <CardDescription>
                  Status of the migration process for {sourceConfig.clusterName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Progress value={status === 'completed' ? 100 : (migrationProgress.step / 5) * 100} className="w-full" />
                
                <div className="space-y-3">
                  {[
                    "Exporting resources from source cluster", 
                    "Transforming resource manifests", 
                    "Deploying resources to target cluster", 
                    "Migrating persistent volumes", 
                    "Verifying successful migration"
                  ].map((step, index) => (
                    <div key={index} className="flex items-center">
                      {migrationProgress.step > index ? (
                        <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center mr-3">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : migrationProgress.step === index ? (
                        <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center animate-pulse mr-3">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-200 dark:border-gray-700 mr-3" />
                      )}
                      <span className={migrationProgress.step >= index ? 'text-foreground' : 'text-muted-foreground'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                
                {migrationProgress.message && (
                  <div className="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-md text-sm text-primary-700 dark:text-primary-300">
                    {migrationProgress.message}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {error && (
              <BlurContainer className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
              </div>
              </BlurContainer>
            )}
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle>Migration Complete</CardTitle>
                <CardDescription>
                  Your cluster has been successfully migrated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center py-6">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-medium">Migration Successful</h3>
                  <p className="text-muted-foreground text-center max-w-md mt-2">
                    {sourceConfig.clusterName} has been successfully migrated to a multi-tenant setup
                    with {targetConfig.clusterName}.
              </p>
            </div>
            
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-md">
                  <h4 className="font-medium text-green-800 dark:text-green-300 mb-2">Summary</h4>
                  <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Migrated {pods.filter(p => p.selected).length} pods
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Migrated {persistentVolumes.filter(pv => pv.selected).length} persistent volumes
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Updated cluster type from single to multi-tenant
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Created new kubeconfig for multi-tenant setup
                    </li>
              </ul>
            </div>
              </CardContent>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Render appropriate buttons for current step
  const renderStepButtons = () => {
    switch(currentStep) {
      case 0:
        return (
          <>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              onClick={connectToClusters}
              disabled={
                status === 'running' || 
                !sourceCluster || 
                !targetCluster || 
                availableSingleClusters.length === 0 || 
                availableMultiClusters.length === 0
              }
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect Clusters <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        );
        
      case 1:
        return (
          <>
            <Button
              variant="outline"
              onClick={() => {
              setCurrentStep(0);
                setProgress(0);
              }}
            >
              Back
            </Button>
            <Button
              onClick={proceedToCompatibilityCheck}
              disabled={status === 'running' || pods.filter(p => p.selected).length === 0 && persistentVolumes.filter(pv => pv.selected).length === 0}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        );
        
      case 2:
        return (
          <>
            <Button
              variant="outline"
              onClick={() => {
              setCurrentStep(1);
                setProgress(((currentStep) / steps.length) * 100);
              }}
            >
              Back
            </Button>
            <Button 
              onClick={startMigration} 
              disabled={status === 'running' || !compatibility.compatible}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Start Migration <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        );
        
      case 3:
        return (
          <>
            {status === 'error' ? (
              <>
                <Button
                  variant="outline"
                  onClick={resetMigration}
                >
                  Restart
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </>
            ) : status === 'completed' ? (
              <Button
                onClick={() => {
                  setCurrentStep(4);
                  setProgress(100);
                }}
              >
                Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            ) : (
              <Button
                variant="outline"
                disabled
              >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating...
            </Button>
            )}
          </>
        );
        
      case 4:
        return (
          <>
            <Button
              variant="outline"
              onClick={resetMigration}
            >
              Start New Migration
            </Button>
            <Button
              onClick={finishMigration}
            >
              Finish
            </Button>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
        
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`flex flex-col items-center max-w-[100px] text-center ${
                currentStep >= index 
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center mb-2
                ${currentStep > index 
                  ? 'bg-primary text-primary-foreground' 
                  : currentStep === index
                    ? 'border-2 border-primary'
                    : 'border-2 border-muted'
                }
              `}>
                {currentStep > index ? (
                    <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="text-xs font-medium">{step.title}</div>
            </div>
          ))}
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>
      
      <div className="flex justify-end space-x-4 mt-8">
        {renderStepButtons()}
      </div>
    </div>
  );
};

export default MigrationWizard;
