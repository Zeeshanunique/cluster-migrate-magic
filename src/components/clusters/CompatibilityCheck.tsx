import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EKSClusterConfig } from '@/utils/aws';

interface CompatibilityCheckProps {
  sourceConfig: EKSClusterConfig;
  targetConfig: EKSClusterConfig;
  compatibilityResult: {
    compatible: boolean;
    issues: string[];
  };
}

const CompatibilityCheck: React.FC<CompatibilityCheckProps> = ({
  sourceConfig,
  targetConfig,
  compatibilityResult
}) => {
  const { compatible, issues = [] } = compatibilityResult || { compatible: false, issues: [] };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Compatibility Check Results</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 border rounded-md">
          <h4 className="font-medium mb-2">Source Cluster</h4>
          <div className="text-sm text-muted-foreground">
            <p><span className="font-medium">Name:</span> {sourceConfig.clusterName}</p>
            <p><span className="font-medium">Region:</span> {sourceConfig.region}</p>
          </div>
        </div>
        
        <div className="p-4 border rounded-md">
          <h4 className="font-medium mb-2">Target Cluster</h4>
          <div className="text-sm text-muted-foreground">
            <p><span className="font-medium">Name:</span> {targetConfig.clusterName}</p>
            <p><span className="font-medium">Region:</span> {targetConfig.region}</p>
          </div>
        </div>
      </div>
      
      {!compatible ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Compatibility Issues Detected</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <ul className="list-disc pl-5 space-y-1">
                {issues && issues.length > 0 ? (
                  issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))
                ) : (
                  <li>Unable to determine specific compatibility issues</li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      ) : issues && issues.length > 0 ? (
        <Alert className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Minor Compatibility Issues</AlertTitle>
          <AlertDescription>
            <p>Migration can proceed, but be aware of the following:</p>
            <div className="mt-2">
              <ul className="list-disc pl-5 space-y-1">
                {issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Clusters Are Compatible</AlertTitle>
          <AlertDescription>
            No compatibility issues detected. You can proceed with the migration.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default CompatibilityCheck;
