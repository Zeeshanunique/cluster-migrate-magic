
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
  Shield
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
import BlurContainer from '@/components/ui/BlurContainer';
import { toast } from 'sonner';
import AWSClusterConfig from './AWSClusterConfig';
import ResourceInventory from './ResourceInventory';
import CompatibilityCheck from './CompatibilityCheck';
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
  checkClusterCompatibility
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
  
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
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
      setCurrentStep(2);
      setProgress(((currentStep + 2) / steps.length) * 100);
      setStatus('idle');
    } catch (error) {
      console.error("Failed to check compatibility:", error);
      setStatus('error');
      setError(`Failed to check compatibility: ${(error as Error).message}`);
    } finally {
      setCheckingCompatibility(false);
    }
  };

  // Start migration
  const startMigration = async () => {
    setStatus('running');
    setCurrentStep(3);
    setProgress(((currentStep + 2) / steps.length) * 100);
    
    const selectedPods = pods.filter(pod => pod.selected);
    const selectedPVs = persistentVolumes.filter(pv => pv.selected);
    
    try {
      // Start the migration process
      const success = await migrateResources(
        sourceConfig,
        targetConfig,
        selectedPods,
        selectedPVs,
        (step, message) => {
          setMigrationProgress({ step, message });
        }
      );
      
      if (success) {
        // Move to verification step
        setCurrentStep(4);
        setProgress(100);
        toast.success("Migration completed successfully");
        setStatus('completed');
      } else {
        setStatus('error');
        setError("Migration failed");
      }
    } catch (error) {
      console.error("Migration failed:", error);
      setStatus('error');
      setError(`Migration failed: ${(error as Error).message}`);
    }
  };

  const resetMigration = () => {
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
  
  const finishMigration = () => {
    navigate('/dashboard');
    toast.success('Cluster migrated successfully');
  };
  
  // Load resources when source is connected and step is inventory
  useEffect(() => {
    if (sourceConnected && currentStep === 1 && nodes.length === 0) {
      loadResources();
    }
  }, [sourceConnected, currentStep]);

  // Render the current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Connect to clusters
        return (
          <div className="space-y-6">
            <AWSClusterConfig
              title="Source EKS Cluster"
              config={sourceConfig}
              onChange={setSourceConfig}
              disabled={status === 'running'}
            />
            
            <AWSClusterConfig
              title="Target EKS Cluster"
              config={targetConfig}
              onChange={setTargetConfig}
              disabled={status === 'running'}
            />
          </div>
        );
        
      case 1: // Resource inventory
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground mb-4">
              Select the resources you want to migrate from <strong>{sourceConfig.clusterName}</strong> to <strong>{targetConfig.clusterName}</strong>.
            </p>
            
            <ResourceInventory
              nodes={nodes}
              pods={pods}
              persistentVolumes={persistentVolumes}
              loading={loadingResources}
              onPodSelectionChange={handlePodSelectionChange}
              onPVSelectionChange={handlePVSelectionChange}
              onSelectAll={handleSelectAll}
            />
          </div>
        );
        
      case 2: // Compatibility check
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground mb-4">
              Checking compatibility between source cluster <strong>{sourceConfig.clusterName}</strong> and target cluster <strong>{targetConfig.clusterName}</strong>.
            </p>
            
            <CompatibilityCheck
              compatible={compatibility.compatible}
              issues={compatibility.issues}
              loading={checkingCompatibility}
            />
            
            <div className="border rounded-md p-4 bg-muted/20">
              <h4 className="font-medium mb-2">Migration Summary</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>{pods.filter(pod => pod.selected).length} pods selected for migration</li>
                <li>{persistentVolumes.filter(pv => pv.selected).length} persistent volumes selected for migration</li>
                <li>Source: {sourceConfig.clusterName} ({sourceConfig.region})</li>
                <li>Target: {targetConfig.clusterName} ({targetConfig.region})</li>
              </ul>
            </div>
          </div>
        );
        
      case 3: // Migration execution
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground mb-4">
              Migrating resources from <strong>{sourceConfig.clusterName}</strong> to <strong>{targetConfig.clusterName}</strong>.
            </p>
            
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-4">Migration Progress</h4>
              <div className="space-y-4">
                <Progress value={(migrationProgress.step / 5) * 100} className="h-2" />
                <p className="text-sm">
                  Step {migrationProgress.step}/5: {migrationProgress.message}
                </p>
              </div>
            </div>
          </div>
        );
        
      case 4: // Verify migration
        return (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 text-green-800 dark:text-green-300">
              <h4 className="font-medium flex items-center">
                <Check className="h-5 w-5 mr-2" />
                Migration Completed Successfully
              </h4>
              <p className="mt-2 text-sm">
                All selected resources have been successfully migrated from <strong>{sourceConfig.clusterName}</strong> to <strong>{targetConfig.clusterName}</strong>.
              </p>
            </div>
            
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-2">Migration Summary</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>{pods.filter(pod => pod.selected).length} pods migrated</li>
                <li>{persistentVolumes.filter(pv => pv.selected).length} persistent volumes migrated</li>
                <li>Source: {sourceConfig.clusterName} ({sourceConfig.region})</li>
                <li>Target: {targetConfig.clusterName} ({targetConfig.region})</li>
              </ul>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Step buttons for each step
  const renderStepButtons = () => {
    switch (currentStep) {
      case 0: // Connect to clusters
        return (
          <>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button onClick={connectToClusters} disabled={status === 'running'}>
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to Clusters'
              )}
            </Button>
          </>
        );
        
      case 1: // Resource inventory
        return (
          <>
            <Button variant="outline" onClick={() => {
              setCurrentStep(0);
              setProgress(((0) / steps.length) * 100);
            }}>
              Back
            </Button>
            <Button onClick={proceedToCompatibilityCheck} disabled={status === 'running' || loadingResources}>
              {status === 'running' || loadingResources ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Check Compatibility'
              )}
            </Button>
          </>
        );
        
      case 2: // Compatibility check
        return (
          <>
            <Button variant="outline" onClick={() => {
              setCurrentStep(1);
              setProgress(((1) / steps.length) * 100);
            }}>
              Back
            </Button>
            <Button 
              onClick={startMigration} 
              disabled={status === 'running' || checkingCompatibility || !compatibility.compatible}
            >
              {status === 'running' || checkingCompatibility ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Start Migration'
              )}
            </Button>
          </>
        );
        
      case 3: // Migration execution
        return (
          <>
            <Button variant="outline" disabled={true}>
              Back
            </Button>
            <Button disabled={true}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating...
            </Button>
          </>
        );
        
      case 4: // Verify migration
        return (
          <>
            <Button variant="outline" onClick={resetMigration}>
              Start New Migration
            </Button>
            <Button onClick={finishMigration}>
              Complete Migration
            </Button>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">AWS EKS Migration Wizard</CardTitle>
        <CardDescription>
          {sourceConfig.clusterName && targetConfig.clusterName 
            ? `Migrating from ${sourceConfig.clusterName} (${sourceConfig.region}) to ${targetConfig.clusterName} (${targetConfig.region})` 
            : 'Migrate your workloads between AWS EKS clusters'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Progress: {Math.round(progress)}%</span>
            <span>Step {currentStep + 1} of {steps.length}</span>
          </div>
        </div>
        
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`p-4 rounded-lg border ${
                currentStep === index 
                  ? 'border-primary/50 bg-primary/5' 
                  : index < currentStep 
                    ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' 
                    : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start">
                <div className={`mr-4 flex items-center justify-center rounded-full w-8 h-8
                  ${
                    currentStep === index 
                      ? 'bg-primary/10 text-primary' 
                      : index < currentStep 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : currentStep === index && status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step.icon || (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-md font-medium mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  
                  {currentStep === index && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                      >
                        {renderStepContent()}
                      </motion.div>
                    </AnimatePresence>
                  )}
                  
                  {status === 'error' && currentStep === index && error && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3"
                      >
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-4 py-3 text-sm text-red-800 dark:text-red-300">
                          <div className="flex items-center">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            <span>{error}</span>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        {renderStepButtons()}
      </CardFooter>
    </Card>
  );
};

export default MigrationWizard;
