import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cluster } from '@/utils/dynamodb';
import { KUBERNETES_API, apiTenantRequest } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Layers, Server, Database, Network, Globe, 
  ShieldAlert, FileText, BarChart, AlertCircle 
} from 'lucide-react';

interface TenantResourcesProps {
  cluster: Cluster;
}

const TenantResources = ({ cluster }: TenantResourcesProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('namespaces');
  
  const [tenantNamespaces, setTenantNamespaces] = useState<any[]>([]);
  const [tenantPods, setTenantPods] = useState<any[]>([]);
  const [tenantDeployments, setTenantDeployments] = useState<any[]>([]);
  const [resourceUsage, setResourceUsage] = useState<any[]>([]);
  
  // Check if this is actually a tenant cluster
  if (cluster.type !== 'tenant') {
    return (
      <Card className="rounded-md shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold">Not a Multi-tenant Cluster</CardTitle>
          <CardDescription>
            This component is only for tenant-type clusters. The current cluster is of type: {cluster.type}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  useEffect(() => {
    const fetchTenantResources = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching tenant resources for cluster:', cluster.name);
        
        // Fetch tenant namespaces
        console.log('Calling API:', KUBERNETES_API.TENANT_NAMESPACES);
        const namespacesResponse = await apiTenantRequest(
          cluster,
          KUBERNETES_API.TENANT_NAMESPACES
        );
        
        console.log('Namespaces response:', namespacesResponse);
        setTenantNamespaces(namespacesResponse.items || []);
        
        // Fetch tenant pods
        console.log('Calling API:', KUBERNETES_API.TENANT_PODS);
        const podsResponse = await apiTenantRequest(
          cluster,
          KUBERNETES_API.TENANT_PODS
        );
        
        console.log('Pods response:', podsResponse);
        setTenantPods(podsResponse.items || []);
        
        // Fetch tenant deployments
        console.log('Calling API:', KUBERNETES_API.TENANT_DEPLOYMENTS);
        const deploymentsResponse = await apiTenantRequest(
          cluster,
          KUBERNETES_API.TENANT_DEPLOYMENTS
        );
        
        console.log('Deployments response:', deploymentsResponse);
        setTenantDeployments(deploymentsResponse.items || []);
        
        // Fetch resource usage
        console.log('Calling API:', KUBERNETES_API.TENANT_RESOURCE_USAGE);
        const usageResponse = await apiTenantRequest(
          cluster,
          KUBERNETES_API.TENANT_RESOURCE_USAGE
        );
        
        console.log('Resource usage response:', usageResponse);
        setResourceUsage(usageResponse.namespaces || []);
        
      } catch (err) {
        console.error('Error fetching tenant resources:', err);
        setError(`Failed to fetch tenant resources: ${err instanceof Error ? err.message : 'Unknown error'}`);
        toast.error('Failed to fetch tenant resources');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTenantResources();
  }, [cluster]);
  
  // Loading state
  if (loading) {
    return (
      <Card className="rounded-md shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold">Multi-tenant Resources</CardTitle>
          <CardDescription>Loading tenant resources...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Card className="rounded-md shadow-md">
        <CardHeader className="pb-2 text-red-500">
          <CardTitle className="text-xl font-semibold flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            Error Loading Tenant Resources
          </CardTitle>
          <CardDescription className="text-red-400">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card className="rounded-md shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">Multi-tenant Resources</CardTitle>
        <CardDescription>
          Resources across all tenant namespaces in this cluster
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="namespaces" className="flex items-center">
              <Layers className="mr-2 h-4 w-4" />
              Namespaces
            </TabsTrigger>
            <TabsTrigger value="pods" className="flex items-center">
              <Server className="mr-2 h-4 w-4" />
              Pods
            </TabsTrigger>
            <TabsTrigger value="deployments" className="flex items-center">
              <Database className="mr-2 h-4 w-4" />
              Deployments
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center">
              <BarChart className="mr-2 h-4 w-4" />
              Resource Usage
            </TabsTrigger>
          </TabsList>
          
          {/* Namespaces Tab */}
          <TabsContent value="namespaces">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tenant Namespaces</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenantNamespaces.length === 0 ? (
                  <div className="col-span-2 text-center p-4 border rounded-md bg-muted/20">
                    No tenant namespaces found.
                  </div>
                ) : (
                  tenantNamespaces.map((ns) => (
                    <Card key={ns.metadata.name} className="overflow-hidden">
                      <CardHeader className="bg-muted/20 pb-2 pt-3">
                        <CardTitle className="text-base font-medium">
                          {ns.metadata.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3 text-sm">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          <span className="text-muted-foreground">Status:</span>
                          <span>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {ns.status.phase}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground">Created:</span>
                          <span>{new Date(ns.metadata.creationTimestamp).toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Pods Tab */}
          <TabsContent value="pods">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tenant Pods</h3>
              <div className="overflow-auto max-h-96">
                <table className="w-full min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Namespace</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Node</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tenantPods.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No tenant pods found
                        </td>
                      </tr>
                    ) : (
                      tenantPods.map((pod) => (
                        <tr key={`${pod.metadata.namespace}-${pod.metadata.name}`}>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{pod.metadata.name}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{pod.metadata.namespace}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <Badge 
                              variant="outline" 
                              className={
                                pod.status.phase === 'Running' 
                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                  : pod.status.phase === 'Pending'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }
                            >
                              {pod.status.phase}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{pod.spec.nodeName || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
          
          {/* Deployments Tab */}
          <TabsContent value="deployments">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tenant Deployments</h3>
              <div className="overflow-auto max-h-96">
                <table className="w-full min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Namespace</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Replicas</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tenantDeployments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No tenant deployments found
                        </td>
                      </tr>
                    ) : (
                      tenantDeployments.map((deployment) => (
                        <tr key={`${deployment.metadata.namespace}-${deployment.metadata.name}`}>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{deployment.metadata.name}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{deployment.metadata.namespace}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">{deployment.spec.replicas}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <Badge 
                              variant="outline" 
                              className={
                                deployment.status.availableReplicas === deployment.spec.replicas 
                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }
                            >
                              {deployment.status.availableReplicas || 0} / {deployment.spec.replicas}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
          
          {/* Resource Usage Tab */}
          <TabsContent value="usage">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tenant Resource Usage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resourceUsage.length === 0 ? (
                  <div className="col-span-2 text-center p-4 border rounded-md bg-muted/20">
                    No resource usage data found.
                  </div>
                ) : (
                  resourceUsage.map((ns) => (
                    <Card key={ns.namespace} className="overflow-hidden">
                      <CardHeader className="bg-muted/20 pb-2 pt-3">
                        <CardTitle className="text-base font-medium">
                          {ns.namespace}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3 text-sm">
                        <div className="space-y-2">
                          {ns.quotas.map((quota: any) => (
                            <div key={quota.name} className="space-y-1">
                              <h4 className="font-medium">{quota.name}</h4>
                              <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                                <span className="text-muted-foreground">Resource</span>
                                <span className="text-muted-foreground">Used</span>
                                <span className="text-muted-foreground">Limit</span>
                                
                                {Object.keys(quota.hard).map(resource => (
                                  <React.Fragment key={resource}>
                                    <span>{resource}</span>
                                    <span>{quota.used[resource] || '0'}</span>
                                    <span>{quota.hard[resource]}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TenantResources; 