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
  deployments?: {
    name: string;
    namespace: string;
    replicas: number;
    availableReplicas: number;
    strategy: string;
    age: string;
    selected: boolean;
  }[];
  statefulSets?: {
    name: string;
    namespace: string;
    replicas: number;
    readyReplicas: number;
    serviceName: string;
    age: string;
    selected: boolean;
  }[];
  daemonSets?: {
    name: string;
    namespace: string;
    desired: number;
    current: number;
    ready: number;
    age: string;
    selected: boolean;
  }[];
  replicaSets?: {
    name: string;
    namespace: string;
    desired: number;
    current: number;
    ready: number;
    age: string;
    selected: boolean;
  }[];
  jobs?: {
    name: string;
    namespace: string;
    completions: number;
    duration: string;
    age: string;
    selected: boolean;
  }[];
  cronJobs?: {
    name: string;
    namespace: string;
    schedule: string;
    lastSchedule: string;
    age: string;
    selected: boolean;
  }[];
  services?: {
    name: string;
    namespace: string;
    type: string;
    clusterIP: string;
    externalIP?: string;
    ports: string;
    age: string;
    selected: boolean;
  }[];
  ingresses?: {
    name: string;
    namespace: string;
    hosts: string[];
    tls: boolean;
    age: string;
    selected: boolean;
  }[];
  configMaps?: {
    name: string;
    namespace: string;
    dataCount: number;
    age: string;
    selected: boolean;
  }[];
  secrets?: {
    name: string;
    namespace: string;
    type: string;
    dataCount: number;
    age: string;
    selected: boolean;
  }[];
  persistentVolumeClaims?: {
    name: string;
    namespace: string;
    status: string;
    volume: string;
    capacity: string;
    accessModes: string[];
    storageClass: string;
    age: string;
    selected: boolean;
  }[];
}

const CompatibilityCheck: React.FC<CompatibilityCheckProps> = ({
  sourceConfig,
  targetConfig,
  compatibilityResult,
  namespaces = [],
  nodes = [],
  pods = [],
  persistentVolumes = [],
  deployments = [],
  statefulSets = [],
  daemonSets = [],
  replicaSets = [],
  jobs = [],
  cronJobs = [],
  services = [],
  ingresses = [],
  configMaps = [],
  secrets = [],
  persistentVolumeClaims = []
}) => {
  const { compatible, issues = [] } = compatibilityResult || { compatible: false, issues: [] };
  
  // Filter only selected resources
  const selectedNamespaces = namespaces.filter(ns => ns.selected);
  const selectedNodes = nodes.filter(node => node.selected);
  const selectedPods = pods.filter(pod => pod.selected);
  const selectedPVs = persistentVolumes.filter(pv => pv.selected);
  const selectedDeployments = deployments.filter(d => d.selected);
  const selectedStatefulSets = statefulSets.filter(ss => ss.selected);
  const selectedDaemonSets = daemonSets.filter(ds => ds.selected);
  const selectedReplicaSets = replicaSets.filter(rs => rs.selected);
  const selectedJobs = jobs.filter(job => job.selected);
  const selectedCronJobs = cronJobs.filter(cj => cj.selected);
  const selectedServices = services.filter(s => s.selected);
  const selectedIngresses = ingresses.filter(i => i.selected);
  const selectedConfigMaps = configMaps.filter(cm => cm.selected);
  const selectedSecrets = secrets.filter(s => s.selected);
  const selectedPVCs = persistentVolumeClaims.filter(pvc => pvc.selected);
  
  // Count total resources
  const totalSelectedResources = 
    selectedNamespaces.length + 
    selectedNodes.length + 
    selectedPods.length + 
    selectedPVs.length + 
    selectedDeployments.length + 
    selectedStatefulSets.length + 
    selectedDaemonSets.length + 
    selectedReplicaSets.length + 
    selectedJobs.length + 
    selectedCronJobs.length +
    selectedServices.length +
    selectedIngresses.length +
    selectedConfigMaps.length +
    selectedSecrets.length +
    selectedPVCs.length;

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
            
            {selectedDeployments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Deployments ({selectedDeployments.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDeployments.map(d => (
                    <Badge key={`${d.namespace}-${d.name}`} variant="outline" className="bg-indigo-50 dark:bg-indigo-950/30">
                      {d.namespace}/{d.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedStatefulSets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> StatefulSets ({selectedStatefulSets.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStatefulSets.map(ss => (
                    <Badge key={`${ss.namespace}-${ss.name}`} variant="outline" className="bg-cyan-50 dark:bg-cyan-950/30">
                      {ss.namespace}/{ss.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedDaemonSets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> DaemonSets ({selectedDaemonSets.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDaemonSets.map(ds => (
                    <Badge key={`${ds.namespace}-${ds.name}`} variant="outline" className="bg-rose-50 dark:bg-rose-950/30">
                      {ds.namespace}/{ds.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedReplicaSets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> ReplicaSets ({selectedReplicaSets.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedReplicaSets.map(rs => (
                    <Badge key={`${rs.namespace}-${rs.name}`} variant="outline" className="bg-purple-50 dark:bg-purple-950/30">
                      {rs.namespace}/{rs.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Jobs ({selectedJobs.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedJobs.map(job => (
                    <Badge key={`${job.namespace}-${job.name}`} variant="outline" className="bg-teal-50 dark:bg-teal-950/30">
                      {job.namespace}/{job.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedCronJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> CronJobs ({selectedCronJobs.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCronJobs.map(cj => (
                    <Badge key={`${cj.namespace}-${cj.name}`} variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30">
                      {cj.namespace}/{cj.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedServices.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Services ({selectedServices.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedServices.map(s => (
                    <Badge key={`${s.namespace}-${s.name}`} variant="outline" className="bg-pink-50 dark:bg-pink-950/30">
                      {s.namespace}/{s.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedIngresses.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Ingresses ({selectedIngresses.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedIngresses.map(i => (
                    <Badge key={`${i.namespace}-${i.name}`} variant="outline" className="bg-fuchsia-50 dark:bg-fuchsia-950/30">
                      {i.namespace}/{i.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedConfigMaps.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> ConfigMaps ({selectedConfigMaps.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedConfigMaps.map(cm => (
                    <Badge key={`${cm.namespace}-${cm.name}`} variant="outline" className="bg-lime-50 dark:bg-lime-950/30">
                      {cm.namespace}/{cm.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedSecrets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> Secrets ({selectedSecrets.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSecrets.map(s => (
                    <Badge key={`${s.namespace}-${s.name}`} variant="outline" className="bg-teal-50 dark:bg-teal-950/30">
                      {s.namespace}/{s.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {selectedPVCs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center"><Box className="h-4 w-4 mr-2"/> PersistentVolumeClaims ({selectedPVCs.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPVCs.map(pvc => (
                    <Badge key={`${pvc.namespace}-${pvc.name}`} variant="outline" className="bg-cyan-50 dark:bg-cyan-950/30">
                      {pvc.namespace}/{pvc.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
