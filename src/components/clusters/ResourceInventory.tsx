import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EKSNodeInfo, EKSPodInfo, EKSPVInfo } from '@/utils/aws';

// Extend base types to include selected property
interface SelectableResource {
  selected?: boolean;
}

type SelectableEKSNodeInfo = EKSNodeInfo & SelectableResource;
type SelectableEKSPodInfo = EKSPodInfo & SelectableResource;
type SelectableEKSPVInfo = EKSPVInfo & SelectableResource;
import { Loader2, Server, Database, Network, Settings, HardDrive, Activity, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KUBERNETES_API, apiRequest } from '@/utils/api';

// Define interfaces for all Kubernetes resource types
interface KubernetesResource {
  name: string;
  namespace: string;
  selected?: boolean;
  status?: string;
}

interface Namespace {
  name: string;
  status: string;
  age: string;
  selected?: boolean;
}

interface Deployment extends KubernetesResource {
  replicas: number;
  availableReplicas: number;
  strategy: string;
  age: string;
}

interface ReplicaSet extends KubernetesResource {
  desired: number;
  current: number;
  ready: number;
  age: string;
}

interface StatefulSet extends KubernetesResource {
  replicas: number;
  readyReplicas: number;
  serviceName: string;
  age: string;
}

interface DaemonSet extends KubernetesResource {
  desired: number;
  current: number;
  ready: number;
  age: string;
}

interface Job extends KubernetesResource {
  completions: number;
  duration: string;
  age: string;
}

interface CronJob extends KubernetesResource {
  schedule: string;
  lastSchedule: string;
  age: string;
}

interface Service extends KubernetesResource {
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: string;
  age: string;
}

interface Ingress extends KubernetesResource {
  hosts: string[];
  tls: boolean;
  age: string;
}

interface ConfigMap extends KubernetesResource {
  dataCount: number;
  age: string;
}

interface Secret extends KubernetesResource {
  type: string;
  dataCount: number;
  age: string;
}

interface ResourceInventoryProps {
  // Core resources
  namespaces?: Namespace[];
  nodes?: SelectableEKSNodeInfo[];
  
  // Workloads
  pods?: SelectableEKSPodInfo[];
  deployments?: Deployment[];
  replicaSets?: ReplicaSet[];
  statefulSets?: StatefulSet[];
  daemonSets?: DaemonSet[];
  jobs?: Job[];
  cronJobs?: CronJob[];
  
  // Networking
  services?: Service[];
  ingresses?: Ingress[];
  
  // Configuration
  configMaps?: ConfigMap[];
  secrets?: Secret[];
  
  // Storage
  persistentVolumes?: SelectableEKSPVInfo[];
  persistentVolumeClaims?: any[];
  
  // Additional props
  sourceCluster?: any;
  isLoading?: boolean;
  loadResources?: () => void;
  onResourceSelectionChange: (resourceType: string, resource: any, selected: boolean) => void;
  onSelectAll: (resourceType: string, selectAll: boolean) => void;
}

const ResourceInventory: React.FC<ResourceInventoryProps> = ({
  // Core resources
  namespaces = [],
  nodes = [],
  
  // Workloads
  pods = [],
  deployments = [],
  replicaSets = [],
  statefulSets = [],
  daemonSets = [],
  jobs = [],
  cronJobs = [],
  
  // Networking
  services = [],
  ingresses = [],
  
  // Configuration
  configMaps = [],
  secrets = [],
  
  // Storage
  persistentVolumes = [],
  persistentVolumeClaims = [],
  
  // Additional props
  sourceCluster,
  isLoading = false,
  loadResources,
  onResourceSelectionChange,
  onSelectAll
}) => {
  // State for currently selected tab category and resource type
  const [selectedCategory, setSelectedCategory] = useState('workloads');
  const [selectedResourceType, setSelectedResourceType] = useState('deployments');
  
  // Calculate selected counts for each resource type
  const selectedCounts = {
    namespaces: namespaces.filter(ns => ns.selected === true).length,
    nodes: nodes.filter(node => node.selected === true).length,
    pods: pods.filter(pod => pod.selected === true).length,
    deployments: deployments.filter(d => d.selected === true).length,
    replicaSets: replicaSets.filter(rs => rs.selected === true).length,
    statefulSets: statefulSets.filter(ss => ss.selected === true).length,
    daemonSets: daemonSets.filter(ds => ds.selected === true).length,
    jobs: jobs.filter(job => job.selected === true).length,
    cronJobs: cronJobs.filter(cj => cj.selected === true).length,
    services: services.filter(svc => svc.selected === true).length,
    ingresses: ingresses.filter(ing => ing.selected === true).length,
    configMaps: configMaps.filter(cm => cm.selected === true).length,
    secrets: secrets.filter(s => s.selected === true).length,
    persistentVolumes: persistentVolumes.filter(pv => pv.selected === true).length,
    persistentVolumeClaims: persistentVolumeClaims.filter(pvc => pvc.selected === true).length,
  };
  
  // Define resource groups
  const resourceGroups = {
    core: ['namespaces', 'nodes'],
    workloads: ['pods', 'deployments', 'replicaSets', 'statefulSets', 'daemonSets', 'jobs', 'cronJobs'],
    networking: ['services', 'ingresses'],
    configuration: ['configMaps', 'secrets'],
    storage: ['persistentVolumes', 'persistentVolumeClaims'],
  };
  
  // Get stateless resources (primarily things that can be migrated without state)
  const statelessResources = ['deployments', 'services', 'configMaps', 'secrets', 'jobs', 'cronJobs'];
  
  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ready':
      case 'running':
      case 'bound':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
      case 'available':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'notready':
      case 'failed':
      case 'released':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">
          {sourceCluster ? (
            <span>Resource Inventory: <Badge variant="outline" className="ml-1">{sourceCluster.name}</Badge></span>
          ) : (
            'Resource Inventory'
          )}
        </h3>
        {loadResources && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadResources}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading Resources...
              </>
            ) : (
              'Refresh Resources'
            )}
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground mb-2">
        Select resources to migrate. Stateless resources are recommended for migration.
      </div>

      <Tabs 
        defaultValue="workloads" 
        value={selectedCategory} 
        onValueChange={setSelectedCategory}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="core" className="flex items-center gap-1">
            <Globe className="h-4 w-4" /> Core ({namespaces.length + nodes.length})
          </TabsTrigger>
          <TabsTrigger value="workloads" className="flex items-center gap-1">
            <Server className="h-4 w-4" /> Workloads
            {Object.entries(selectedCounts)
              .filter(([key]) => resourceGroups.workloads.includes(key))
              .reduce((acc, [_, count]) => acc + count, 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.entries(selectedCounts)
                    .filter(([key]) => resourceGroups.workloads.includes(key))
                    .reduce((acc, [_, count]) => acc + count, 0)}
                </Badge>
              )}
          </TabsTrigger>
          <TabsTrigger value="networking" className="flex items-center gap-1">
            <Network className="h-4 w-4" /> Networking
            {Object.entries(selectedCounts)
              .filter(([key]) => resourceGroups.networking.includes(key))
              .reduce((acc, [_, count]) => acc + count, 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.entries(selectedCounts)
                    .filter(([key]) => resourceGroups.networking.includes(key))
                    .reduce((acc, [_, count]) => acc + count, 0)}
                </Badge>
              )}
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-1">
            <Settings className="h-4 w-4" /> Config
            {Object.entries(selectedCounts)
              .filter(([key]) => resourceGroups.configuration.includes(key))
              .reduce((acc, [_, count]) => acc + count, 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.entries(selectedCounts)
                    .filter(([key]) => resourceGroups.configuration.includes(key))
                    .reduce((acc, [_, count]) => acc + count, 0)}
                </Badge>
              )}
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-1">
            <HardDrive className="h-4 w-4" /> Storage
            {Object.entries(selectedCounts)
              .filter(([key]) => resourceGroups.storage.includes(key))
              .reduce((acc, [_, count]) => acc + count, 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.entries(selectedCounts)
                    .filter(([key]) => resourceGroups.storage.includes(key))
                    .reduce((acc, [_, count]) => acc + count, 0)}
                </Badge>
              )}
          </TabsTrigger>
        </TabsList>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Core Resources Tab */}
            <TabsContent value="core" className="border rounded-md">
              <Tabs defaultValue="namespaces" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="namespaces">
                    Namespaces ({namespaces.length})
                    {selectedCounts.namespaces > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.namespaces}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="nodes">
                    Nodes ({nodes.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="namespaces" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('namespaces', true)}
                        disabled={namespaces.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('namespaces', false)}
                        disabled={selectedCounts.namespaces === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.namespaces} of {namespaces.length} namespaces selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {namespaces.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No namespaces found
                            </TableCell>
                          </TableRow>
                        ) : (
                          namespaces.map((namespace) => (
                            <TableRow key={namespace.name}>
                              <TableCell>
                                <Checkbox
                                  checked={namespace.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('namespaces', namespace, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{namespace.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(namespace.status)}>
                                  {namespace.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{namespace.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="nodes" className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Instance Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Max Pods</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No nodes found
                          </TableCell>
                        </TableRow>
                      ) : (
                        nodes.map((node) => (
                          <TableRow key={node.name}>
                            <TableCell className="font-medium">{node.name}</TableCell>
                            <TableCell>{node.instanceType}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(node.status)}>
                                {node.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{node.capacity?.cpu || 'Unknown'}</TableCell>
                            <TableCell>{node.capacity?.memory || 'Unknown'}</TableCell>
                            <TableCell>{node.capacity?.pods || 'Unknown'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </TabsContent>
            
            {/* Workloads Tab - Stateless resources highlighted */}
            <TabsContent value="workloads" className="border rounded-md">
              <Tabs defaultValue="deployments" className="w-full">
                <TabsList className="w-full grid grid-cols-7">
                  <TabsTrigger 
                    value="deployments" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('deployments')}
                  >
                    Deployments
                    {selectedCounts.deployments > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.deployments}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="statefulSets" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('statefulSets')}
                  >
                    StatefulSets
                    {selectedCounts.statefulSets > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.statefulSets}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="daemonSets" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('daemonSets')}
                  >
                    DaemonSets
                    {selectedCounts.daemonSets > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.daemonSets}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="replicaSets" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('replicaSets')}
                  >
                    ReplicaSets
                    {selectedCounts.replicaSets > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.replicaSets}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="pods" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('pods')}
                  >
                    Pods
                    {selectedCounts.pods > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.pods}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="jobs" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('jobs')}
                  >
                    Jobs
                    {selectedCounts.jobs > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.jobs}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="cronJobs" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('cronJobs')}
                  >
                    CronJobs
                    {selectedCounts.cronJobs > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.cronJobs}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                </TabsList>
                
                {/* Deployments - Stateless */}
                <TabsContent value="deployments" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('deployments', true)}
                        disabled={deployments.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('deployments', false)}
                        disabled={selectedCounts.deployments === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.deployments} of {deployments.length} deployments selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Replicas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Strategy</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deployments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              No deployments found
                            </TableCell>
                          </TableRow>
                        ) : (
                          deployments.map((deployment) => (
                            <TableRow key={`${deployment.namespace}-${deployment.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={deployment.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('deployments', deployment, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{deployment.name}</TableCell>
                              <TableCell>{deployment.namespace}</TableCell>
                              <TableCell>{deployment.availableReplicas}/{deployment.replicas}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(deployment.status || '')}>
                                  {deployment.status || (deployment.availableReplicas === deployment.replicas ? 'Ready' : 'Not Ready')}
                                </Badge>
                              </TableCell>
                              <TableCell>{deployment.strategy}</TableCell>
                              <TableCell>{deployment.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                {/* Pods Tab */}
                <TabsContent value="pods" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('pods', true)}
                        disabled={pods.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('pods', false)}
                        disabled={selectedCounts.pods === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.pods} of {pods.length} pods selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Containers</TableHead>
                          <TableHead>Restarts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pods.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No pods found
                            </TableCell>
                          </TableRow>
                        ) : (
                          pods.map((pod) => (
                            <TableRow key={`${pod.namespace}-${pod.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={pod.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('pods', pod, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{pod.name}</TableCell>
                              <TableCell>{pod.namespace}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(pod.status)}>
                                  {pod.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{pod.containerCount}</TableCell>
                              <TableCell>{pod.restarts}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>
            
            {/* Networking Tab */}
            <TabsContent value="networking" className="border rounded-md">
              <Tabs defaultValue="services" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger 
                    value="services" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('services')}
                  >
                    Services ({services.length})
                    {selectedCounts.services > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.services}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="ingresses" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('ingresses')}
                  >
                    Ingresses ({ingresses.length})
                    {selectedCounts.ingresses > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.ingresses}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Services Tab - Stateless */}
                <TabsContent value="services" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('services', true)}
                        disabled={services.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('services', false)}
                        disabled={selectedCounts.services === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.services} of {services.length} services selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Cluster IP</TableHead>
                          <TableHead>External IP</TableHead>
                          <TableHead>Ports</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              No services found
                            </TableCell>
                          </TableRow>
                        ) : (
                          services.map((service) => (
                            <TableRow key={`${service.namespace}-${service.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={service.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('services', service, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{service.name}</TableCell>
                              <TableCell>{service.namespace}</TableCell>
                              <TableCell>{service.type}</TableCell>
                              <TableCell>{service.clusterIP}</TableCell>
                              <TableCell>{service.externalIP || '-'}</TableCell>
                              <TableCell>{service.ports}</TableCell>
                              <TableCell>{service.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                {/* Ingresses Tab */}
                <TabsContent value="ingresses" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('ingresses', true)}
                        disabled={ingresses.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('ingresses', false)}
                        disabled={selectedCounts.ingresses === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.ingresses} of {ingresses.length} ingresses selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Hosts</TableHead>
                          <TableHead>TLS</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ingresses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No ingresses found
                            </TableCell>
                          </TableRow>
                        ) : (
                          ingresses.map((ingress) => (
                            <TableRow key={`${ingress.namespace}-${ingress.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={ingress.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('ingresses', ingress, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{ingress.name}</TableCell>
                              <TableCell>{ingress.namespace}</TableCell>
                              <TableCell>{ingress.hosts.join(', ')}</TableCell>
                              <TableCell>{ingress.tls ? 'Yes' : 'No'}</TableCell>
                              <TableCell>{ingress.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>
            
            {/* Configuration Tab */}
            <TabsContent value="configuration" className="border rounded-md">
              <Tabs defaultValue="configMaps" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger 
                    value="configMaps" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('configMaps')}
                  >
                    ConfigMaps ({configMaps.length})
                    {selectedCounts.configMaps > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.configMaps}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="secrets" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('secrets')}
                  >
                    Secrets ({secrets.length})
                    {selectedCounts.secrets > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.secrets}</Badge>
                    )}
                    <Badge variant="outline" className="ml-1 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Stateless</Badge>
                  </TabsTrigger>
                </TabsList>
                
                {/* ConfigMaps Tab - Stateless */}
                <TabsContent value="configMaps" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('configMaps', true)}
                        disabled={configMaps.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('configMaps', false)}
                        disabled={selectedCounts.configMaps === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.configMaps} of {configMaps.length} config maps selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Data Items</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configMaps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No config maps found
                            </TableCell>
                          </TableRow>
                        ) : (
                          configMaps.map((configMap) => (
                            <TableRow key={`${configMap.namespace}-${configMap.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={configMap.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('configMaps', configMap, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{configMap.name}</TableCell>
                              <TableCell>{configMap.namespace}</TableCell>
                              <TableCell>{configMap.dataCount}</TableCell>
                              <TableCell>{configMap.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                {/* Secrets Tab - Stateless */}
                <TabsContent value="secrets" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('secrets', true)}
                        disabled={secrets.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('secrets', false)}
                        disabled={selectedCounts.secrets === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.secrets} of {secrets.length} secrets selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Data Items</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {secrets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No secrets found
                            </TableCell>
                          </TableRow>
                        ) : (
                          secrets.map((secret) => (
                            <TableRow key={`${secret.namespace}-${secret.name}`}>
                              <TableCell>
                                <Checkbox
                                  checked={secret.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('secrets', secret, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{secret.name}</TableCell>
                              <TableCell>{secret.namespace}</TableCell>
                              <TableCell>{secret.type}</TableCell>
                              <TableCell>{secret.dataCount}</TableCell>
                              <TableCell>{secret.age}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>
            
            {/* Storage Tab */}
            <TabsContent value="storage" className="border rounded-md">
              <Tabs defaultValue="persistentVolumes" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger 
                    value="persistentVolumes" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('persistentVolumes')}
                  >
                    PersistentVolumes ({persistentVolumes.length})
                    {selectedCounts.persistentVolumes > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.persistentVolumes}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="persistentVolumeClaims" 
                    className="flex items-center gap-1"
                    onClick={() => setSelectedResourceType('persistentVolumeClaims')}
                  >
                    PVCs ({persistentVolumeClaims.length})
                    {selectedCounts.persistentVolumeClaims > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedCounts.persistentVolumeClaims}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* PersistentVolumes Tab */}
                <TabsContent value="persistentVolumes" className="mt-2">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('persistentVolumes', true)}
                        disabled={persistentVolumes.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAll('persistentVolumes', false)}
                        disabled={selectedCounts.persistentVolumes === 0}
                        className="ml-2"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCounts.persistentVolumes} of {persistentVolumes.length} volumes selected
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Storage Class</TableHead>
                          <TableHead>Capacity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Claim</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {persistentVolumes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No persistent volumes found
                            </TableCell>
                          </TableRow>
                        ) : (
                          persistentVolumes.map((pv) => (
                            <TableRow key={pv.name}>
                              <TableCell>
                                <Checkbox
                                  checked={pv.selected}
                                  onCheckedChange={(checked) => 
                                    onResourceSelectionChange('persistentVolumes', pv, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{pv.name}</TableCell>
                              <TableCell>{pv.storageClass}</TableCell>
                              <TableCell>{pv.capacity}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(pv.status)}>
                                  {pv.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{pv.claim || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default ResourceInventory;
