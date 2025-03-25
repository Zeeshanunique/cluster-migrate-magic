import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EKSNodeInfo, EKSPodInfo, EKSPVInfo } from '@/utils/aws';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ResourceInventoryProps {
  // Pods and PVs are required, but nodes might not be passed
  nodes?: EKSNodeInfo[];
  pods: EKSPodInfo[];
  persistentVolumes: EKSPVInfo[];
  isLoading?: boolean;  // Changed from loading to isLoading
  loadResources?: () => void; // Added this as it's being passed
  onPodSelectionChange: (pod: EKSPodInfo, selected: boolean) => void;
  onPVSelectionChange: (pv: EKSPVInfo, selected: boolean) => void;
  onSelectAll: (resourceType: 'pods' | 'pvs', selectAll: boolean) => void;
}

const ResourceInventory: React.FC<ResourceInventoryProps> = ({
  nodes = [], // Provide a default empty array
  pods = [], // Provide a default empty array
  persistentVolumes = [], // Provide a default empty array
  isLoading = false, // Default to false
  loadResources,
  onPodSelectionChange,
  onPVSelectionChange,
  onSelectAll
}) => {
  // Calculate selected counts
  const selectedPods = pods.filter(pod => pod.selected).length;
  const selectedPVs = persistentVolumes.filter(pv => pv.selected).length;
  
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
        <h3 className="text-lg font-medium">Resource Inventory</h3>
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
                Loading...
              </>
            ) : (
              'Load Resources'
            )}
          </Button>
        )}
      </div>

      <Tabs defaultValue="nodes">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nodes">
            Nodes ({nodes.length})
          </TabsTrigger>
          <TabsTrigger value="pods">
            Pods ({pods.length}) {selectedPods > 0 && `(${selectedPods} selected)`}
          </TabsTrigger>
          <TabsTrigger value="volumes">
            Volumes ({persistentVolumes.length}) {selectedPVs > 0 && `(${selectedPVs} selected)`}
          </TabsTrigger>
        </TabsList>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="nodes" className="border rounded-md">
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
                        <TableCell>{node.capacity.cpu}</TableCell>
                        <TableCell>{node.capacity.memory}</TableCell>
                        <TableCell>{node.capacity.pods}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="pods" className="border rounded-md">
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
                    disabled={selectedPods === 0}
                    className="ml-2"
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedPods} of {pods.length} pods selected
                </div>
              </div>
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
                      <TableRow key={pod.name}>
                        <TableCell>
                          <Checkbox
                            checked={pod.selected}
                            onCheckedChange={(checked) => onPodSelectionChange(pod, !!checked)}
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
            </TabsContent>
            
            <TabsContent value="volumes" className="border rounded-md">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectAll('pvs', true)}
                    disabled={persistentVolumes.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectAll('pvs', false)}
                    disabled={selectedPVs === 0}
                    className="ml-2"
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedPVs} of {persistentVolumes.length} volumes selected
                </div>
              </div>
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
                            onCheckedChange={(checked) => onPVSelectionChange(pv, !!checked)}
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
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default ResourceInventory;
