
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
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

const steps = [
  { id: 'init', title: 'Initialize Migration', description: 'Preparing your cluster for migration' },
  { id: 'backup', title: 'Backup Resources', description: 'Backing up all cluster resources and configurations' },
  { id: 'transform', title: 'Transform Architecture', description: 'Converting single cluster to multi-cluster architecture' },
  { id: 'auth', title: 'Configure Authentication', description: 'Setting up multi-cluster authentication and permissions' },
  { id: 'metadata', title: 'Transfer Metadata', description: 'Migrating metadata, labels, and annotations' },
  { id: 'finalize', title: 'Finalize Migration', description: 'Verifying migration and finalizing the process' },
];

const MigrationWizard = () => {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('cluster') || '';
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
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
    setStatus('running');
    setProgress((1 / steps.length) * 100);
    toast('Migration process started');
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
    setError('Network connectivity issue detected. Please check your connection and try again.');
    toast.error('Migration encountered an error');
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Cluster Migration Wizard</CardTitle>
        <CardDescription>
          {clusterId ? `Migrating cluster ${clusterId} from single to multi-cluster environment` : 
            'Migrate your Kubernetes cluster from single to multi-cluster'}
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
                  ) : (
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
                            <span>Processing {step.id}...</span>
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
              Migrating...
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
