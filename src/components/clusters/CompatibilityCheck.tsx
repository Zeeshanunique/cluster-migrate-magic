
import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CompatibilityCheckProps {
  compatible: boolean;
  issues: string[];
  loading: boolean;
}

const CompatibilityCheck: React.FC<CompatibilityCheckProps> = ({
  compatible,
  issues,
  loading
}) => {
  if (loading) {
    return (
      <Alert className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Checking Compatibility</AlertTitle>
        <AlertDescription>
          Analyzing source and target clusters for compatibility issues...
        </AlertDescription>
      </Alert>
    );
  }

  if (!compatible) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Compatibility Issues Detected</AlertTitle>
        <AlertDescription>
          <div className="mt-2">
            <ul className="list-disc pl-5 space-y-1">
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (issues.length > 0) {
    return (
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
    );
  }

  return (
    <Alert className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
      <CheckCircle className="h-4 w-4" />
      <AlertTitle>Clusters Are Compatible</AlertTitle>
      <AlertDescription>
        No compatibility issues detected. You can proceed with the migration.
      </AlertDescription>
    </Alert>
  );
};

export default CompatibilityCheck;
