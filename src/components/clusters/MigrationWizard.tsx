
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const awsRegions = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "eu-central-1", label: "EU Central (Frankfurt)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
];

const steps = [
  { 
    id: 'init', 
    title: 'Connect to AWS EKS Clusters', 
    description: 'Connect to source and target EKS clusters',
    icon: <Cloud className="h-4 w-4" />
  },
  { 
    id: 'backup', 
    title: 'Backup Resources', 
    description: 'Create snapshots of workloads and persistent volumes',
    icon: <Database className="h-4 w-4" />
  },
  { 
    id: 'transform', 
    title: 'Transform Resources', 
    description: 'Prepare resource manifests for target cluster',
    icon: <Server className="h-4 w-4" />
  },
  { 
    id: 'auth', 
    title: 'Configure IAM Roles', 
    description: 'Set up necessary permissions in target cluster',
    icon: <Shield className="h-4 w-4" />
  },
  { 
    id: 'deploy', 
    title: 'Deploy to Target', 
    description: 'Apply transformed resources to target cluster',
    icon: <ChevronRight className="h-4 w-4" />
  },
  { 
    id: 'finalize', 
    title: 'Validate Migration', 
    description: 'Verify all workloads are running correctly',
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
  const [sourceConfig, setSourceConfig] = useState({
    clusterName: clusterId || '',
    region: 'us-east-1',
  });
  
  const [targetConfig, setTargetConfig] = useState({
    clusterName: '',
    region: 'us-east-1',
  });
  
  useEffect(() => {
    // Simulate the migration process for demo purposes
    if (status === 'running') {
      const timer = setTimeout(() => {
        if (currentStep < steps.length - 1) {
          setCurrentStep((prev) => prev + 1);
          setProgress(((currentStep + 2) / steps.length) * 100);
        } else {
          setStatus('completed');
          setProgress(100);
          toast.success('Migration completed successfully');
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [status, currentStep]);
  
  const startMigration = () => {
    if (!sourceConfig.clusterName || !targetConfig.clusterName) {
      toast.error('Please provide both source and target cluster names');
      return;
    }
    
    setStatus('running');
    setProgress((1 / steps.length) * 100);
    toast('AWS EKS migration process started');
  };
  
  const resetMigration = () => {
    setCurrentStep(0);
    setProgress(0);
    setStatus('idle');
    setError(null);
  };
  
  const finishMigration = () => {
    navigate('/dashboard');
    toast.success('Cluster migrated successfully');
  };
  
  const simulateError = () => {
    setStatus('error');
    setError('AWS API connectivity issue detected. Please check your AWS credentials and cluster configuration.');
    toast.error('Migration encountered an error');
  };

  // Render the configuration form for the initial step
  const renderClusterConfigForm = () => {
    if (currentStep > 0 || status !== 'idle') {
      return null;
    }
    
    return (
      <div className="space-y-4 mb-6 p-4 bg-background/50 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="font-medium">Source EKS Cluster</div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="source-cluster">Cluster Name</Label>
                <Input 
                  id="source-cluster" 
                  placeholder="eks-source-cluster" 
                  value={sourceConfig.clusterName}
                  onChange={(e) => setSourceConfig({...sourceConfig, clusterName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="source-region">AWS Region</Label>
                <Select 
                  value={sourceConfig.region}
                  onValueChange={(value) => setSourceConfig({...sourceConfig, region: value})}
                >
                  <SelectTrigger id="source-region">
                    <SelectValue placeholder="Select AWS Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {awsRegions.map(region => (
                      <SelectItem key={`source-${region.value}`} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="font-medium">Target EKS Cluster</div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="target-cluster">Cluster Name</Label>
                <Input 
                  id="target-cluster" 
                  placeholder="eks-target-cluster" 
                  value={targetConfig.clusterName}
                  onChange={(e) => setTargetConfig({...targetConfig, clusterName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="target-region">AWS Region</Label>
                <Select 
                  value={targetConfig.region}
                  onValueChange={(value) => setTargetConfig({...targetConfig, region: value})}
                >
                  <SelectTrigger id="target-region">
                    <SelectValue placeholder="Select AWS Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {awsRegions.map(region => (
                      <SelectItem key={`target-${region.value}`} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p>This will connect to your AWS EKS clusters using the current IAM credentials.</p>
          <p>Ensure your IAM user/role has sufficient permissions to access both clusters.</p>
        </div>
      </div>
    );
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
        
        {renderClusterConfigForm()}
        
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
                  
                  {currentStep === index && status === 'running' && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3"
                      >
                        <BlurContainer className="px-4 py-3 text-sm" intensity="light">
                          <div className="flex items-center">
                            <Loader2 className="h-3 w-3 animate-spin mr-2 text-primary" />
                            <span>Processing {step.id} for AWS EKS clusters...</span>
                          </div>
                        </BlurContainer>
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
        {status === 'idle' && (
          <>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button onClick={startMigration}>
              Start Migration
            </Button>
          </>
        )}
        
        {status === 'running' && (
          <>
            <Button variant="outline" onClick={simulateError}>
              Simulate Error
            </Button>
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating AWS Clusters...
            </Button>
          </>
        )}
        
        {status === 'completed' && (
          <>
            <Button variant="outline" onClick={resetMigration}>
              Restart
            </Button>
            <Button onClick={finishMigration}>
              Complete <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button onClick={resetMigration}>
              Try Again
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default MigrationWizard;
