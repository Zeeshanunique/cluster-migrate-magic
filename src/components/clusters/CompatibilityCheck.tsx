import React from 'react';
import { CheckCircle, AlertCircle, XCircle, Server, Database, Box, Layers } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EKSClusterConfig, EKSNodeInfo, EKSPodInfo, EKSPVInfo } from '@/utils/aws';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CompatibilityCheckProps {
  sourceConfig: EKSClusterConfig;
  targetConfig: EKSClusterConfig;
  compatibilityResult: {
    compatible: boolean;
    issues: string[];
  };
  namespaces?: {name: string, status: string, age: string, labels: Record<string, string>, selected: boolean}[];
  nodes?: EKSNodeInfo[];
  pods?: EKSPodInfo[];
  persistentVolumes?: EKSPVInfo[];
}

const CompatibilityCheck: React.FC<CompatibilityCheckProps> = ({
  sourceConfig,
  targetConfig,
  compatibilityResult,
  namespaces = [],
  nodes = [],
  pods = [],
  persistentVolumes = []
}) => {
  const { compatible, issues = [] } = compatibilityResult || { compatible: false, issues: [] };
  
  // Filter only selected resources
  const selectedNamespaces = namespaces.filter(ns => ns.selected);
  const selectedNodes = nodes.filter(node => node.selected);
  const selectedPods = pods.filter(pod => pod.selected);
  const selectedPVs = persistentVolumes.filter(pv => pv.selected);
  
  // Count total resources
  const totalSelectedResources = selectedNamespaces.length + selectedNodes.length + selectedPods.length + selectedPVs.length;

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
      
      {/* Display Selected Resources */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selected Resources for Migration</CardTitle>
          <CardDescription>You've selected {totalSelectedResources} resources to migrate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedNamespaces.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Layers className="h-4 w-4 mr-2"/> Namespaces ({selectedNamespaces.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedNamespaces.map(ns => (
                    <Badge key={ns.name} variant="outline" className="bg-blue-50 dark:bg-blue-950/30">
                      {ns.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedNodes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Server className="h-4 w-4 mr-2"/> Nodes ({selectedNodes.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedNodes.map(node => (
                    <Badge key={node.name} variant="outline" className="bg-violet-50 dark:bg-violet-950/30">
                      {node.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedPods.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Pods ({selectedPods.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPods.map(pod => (
                    <Badge key={pod.name} variant="outline" className="bg-green-50 dark:bg-green-950/30">
                      {pod.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedPVs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Database className="h-4 w-4 mr-2"/> Persistent Volumes ({selectedPVs.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPVs.map(pv => (
                    <Badge key={pv.name} variant="outline" className="bg-amber-50 dark:bg-amber-950/30">
                      {pv.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Resources selection is handled in the previous step, so there should always be selections here */}
          </div>
        </CardContent>
      </Card>

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
