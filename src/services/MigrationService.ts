import { apiRequest } from '../utils/api';
import { KUBERNETES_API } from '../utils/api';
import { API_BASE_URL } from '../utils/api';
import { toast } from 'sonner';
import { migrationLogService } from '@/utils/dynamodb';

// Types for migration
export interface ResourceToMigrate {
  kind: string;
  name: string;
  namespace: string;
  apiVersion?: string;
}

export interface MigrationOptions {
  targetNamespace?: string;
  targetStorageClass?: string;
  preserveNodeAffinity?: boolean;
  migrateVolumes?: boolean;
  debugMode?: boolean;
}

export interface MigrationStatus {
  id: string;
  status: 'in-progress' | 'completed' | 'failed' | 'unknown';
  resourcesTotal: number;
  resourcesMigrated: number;
  resourcesFailed: number;
  completedResources: ResourceToMigrate[];
  failedResources: (ResourceToMigrate & { error?: string })[];
  currentStep?: string;
  logs?: { timestamp: Date; level: string; message: string }[];
  error?: string;
  warning?: string;
  duration?: number; // Duration in seconds
}

// Store mapping between client-side IDs and server-returned migrationIds
const migrationIdMap = new Map<string, string>();

// Service for handling migration operations
export const MigrationService = {
  /**
   * Generate YAML for selected resources
   * @param kubeconfig The kubeconfig for the cluster
   * @param resources Array of resources to generate YAML for
   * @returns Promise with the combined YAML string
   */
  async generateYaml(kubeconfig: string, resources: ResourceToMigrate[]): Promise<string> {
    try {
      console.log('Generating YAML for resources:', resources);
      
      const response = await apiRequest(
        KUBERNETES_API.GENERATE_YAML,
        'POST',
        {
          kubeconfig,
          resources
        }
      );
      
      console.log('YAML generation response received');
      return response.yaml || '';
    } catch (error) {
      console.error('Error generating YAML:', error);
      toast.error(`Failed to generate YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Migrate resources from source to target cluster
   * @param sourceKubeconfig The kubeconfig for the source cluster
   * @param targetKubeconfig The kubeconfig for the target cluster
   * @param resources Array of resources to migrate
   * @param options Options for migration process
   * @param sourceCluster Source cluster information
   * @param targetCluster Target cluster information
   * @param userId User ID for tracking
   * @returns Promise with migration ID for status tracking
   */
  async migrateResources(
    sourceKubeconfig: string,
    targetKubeconfig: string,
    resources: ResourceToMigrate[],
    options: MigrationOptions = {},
    sourceCluster: { id: string; name: string },
    targetCluster: { id: string; name: string },
    userId: string
  ): Promise<string> {
    try {
      console.log('Starting migration for resources:', resources);
      
      // Create a migration log entry in DynamoDB
      const startTime = Date.now();
      const clientMigrationId = `migration-${startTime}`; // Generate our client-side ID
      
      const migrationLog = await migrationLogService.createMigrationLog({
        sourceClusterId: sourceCluster.id,
        sourceClusterName: sourceCluster.name,
        targetClusterId: targetCluster.id,
        targetClusterName: targetCluster.name,
        status: 'in-progress',
        resourcesTotal: resources.length
      }, userId);
      
      // Start the actual migration process
      const response = await apiRequest(
        KUBERNETES_API.MIGRATE_RESOURCES,
        'POST',
        {
          sourceKubeconfig,
          targetKubeconfig,
          resources,
          options,
          migrationId: clientMigrationId // Pass our client-side ID to the server
        }
      );
      
      // Extract the server's migration ID from the response
      const serverMigrationId = response.migrationId || startTime.toString();
      console.log('Migration initiated with server ID:', serverMigrationId);
      console.log('Client migration ID:', clientMigrationId);
      
      // Store the mapping between our client ID and the server ID for later reference
      try {
        localStorage.setItem(`migration_id_mapping_${clientMigrationId}`, serverMigrationId);
      } catch (storageError) {
        console.error('Failed to store migration ID mapping:', storageError);
      }
      
      // Return our client-side migration ID 
      return clientMigrationId;
    } catch (error) {
      console.error('Error initiating migration:', error);
      toast.error(`Failed to start migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Get status of a migration
   * @param migrationId ID of the migration
   * @returns Migration status
   */
  async getMigrationStatus(migrationId: string): Promise<MigrationStatus> {
    // Try to get a server-mapped ID if one exists
    const serverMigrationId = migrationIdMap.get(migrationId) || migrationId;
    
    // Prepare potential migration ID formats (with and without "migration-" prefix)
    const possibleIds = [
      serverMigrationId,
      serverMigrationId.startsWith('migration-') ? serverMigrationId : `migration-${serverMigrationId}`,
      serverMigrationId.startsWith('migration-') ? serverMigrationId.replace('migration-', '') : serverMigrationId
    ];
    
    // List of possible endpoint patterns to try
    const endpointPatterns = [
      // Standard endpoint format
      (id: string) => `${KUBERNETES_API.MIGRATION_STATUS_CHECK(id)}`,
      // Legacy format without "migrations" in path
      (id: string) => `${API_BASE_URL}/kube-migrate/k8s/migration/${id}/status`,
      // Alternate format with "migrations" but no "k8s"
      (id: string) => `${API_BASE_URL}/kube-migrate/migrations/${id}/status`,
      // Bare-bones format
      (id: string) => `${API_BASE_URL}/kube-migrate/migration/${id}/status`
    ];
    
    // Try each endpoint pattern with each possible ID format
    for (const pattern of endpointPatterns) {
      for (const id of possibleIds) {
        try {
          const endpoint = pattern(id);
          console.log(`Trying endpoint: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            console.log(`Endpoint failed: ${endpoint}`);
            continue; // Try the next pattern
          }
          
          const data = await response.json();
          console.log(`Success! Found working endpoint: ${endpoint}`);
          
          // If this worked, remember this format for future requests
          if (data.id && data.id !== migrationId) {
            migrationIdMap.set(migrationId, data.id);
          }
          
          // Update the migration log even on success
          await this.updateMigrationLog(migrationId, {
            id: data.id || migrationId,
            status: data.status || 'unknown',
            resourcesTotal: data.resourcesTotal || 0,
            resourcesMigrated: data.resourcesMigrated || 0,
            resourcesFailed: data.resourcesFailed || 0,
            completedResources: data.completedResources || [],
            failedResources: data.failedResources || [],
            currentStep: data.currentStep || '',
            error: data.error || null,
            warning: data.warning || null
          });
          
          return {
            id: data.id || migrationId,
            status: data.status || 'unknown',
            resourcesTotal: data.resourcesTotal || 0,
            resourcesMigrated: data.resourcesMigrated || 0,
            resourcesFailed: data.resourcesFailed || 0,
            completedResources: data.completedResources || [],
            failedResources: data.failedResources || [],
            currentStep: data.currentStep || undefined,
            logs: data.logs || [],
            error: data.error,
            warning: data.warning
          };
        } catch (error) {
          console.error(`Error fetching migration status:`, error);
          // Continue to the next endpoint pattern
        }
      }
    }
    
    // If all endpoints failed, return a default status
    console.error(`All migration status endpoints failed for ID: ${migrationId}`);
    return {
      id: migrationId,
      status: 'unknown',
      resourcesTotal: 0,
      resourcesMigrated: 0,
      resourcesFailed: 0,
      completedResources: [],
      failedResources: [],
      currentStep: '',
      error: 'Failed to fetch migration status',
    };
  },
  
  /**
   * Update the migration log in DynamoDB with the latest status
   * @param migrationId ID of the migration
   * @param status Current migration status
   */
  async updateMigrationLog(migrationId: string, status: MigrationStatus): Promise<void> {
    try {
      console.log(`Updating migration log for ${migrationId}:`, status);
      
      // Calculate duration if the migration is completed or failed
      let duration = undefined;
      if (status.status === 'completed' || status.status === 'failed') {
        // Try to get the start time from the migrationId if it includes a timestamp
        try {
          const timestampPart = migrationId.split('-')[1];
          if (timestampPart && !isNaN(Number(timestampPart))) {
            const startTime = parseInt(timestampPart, 10);
            duration = Math.floor((Date.now() - startTime) / 1000); // Duration in seconds
          }
        } catch (parseError) {
          console.warn('Could not parse migration start time from ID:', parseError);
        }
      }
      
      // Always ensure the status is properly mapped
      const mappedStatus = 
        status.status === 'unknown' ? 'in-progress' : 
        (status.status as 'in-progress' | 'completed' | 'failed');
      
      // Update the migration log in DynamoDB with current status
      await migrationLogService.updateMigrationLog(migrationId, {
        status: mappedStatus,
        resourcesMigrated: status.resourcesMigrated,
        resourcesFailed: status.resourcesFailed,
        completedResources: status.completedResources,
        failedResources: status.failedResources.map(resource => ({
          kind: resource.kind,
          name: resource.name,
          namespace: resource.namespace,
          error: resource.error || 'Unknown error' // Ensure error property is always defined
        })),
        error: status.error,
        duration: duration || status.duration
      });
      
      console.log(`Migration log updated successfully for ${migrationId}`);
    } catch (error) {
      console.error(`Error updating migration log for ${migrationId}:`, error);
    }
  },
  
  /**
   * Group resources by type for display and selection
   * @param resources Flat list of resources
   * @returns Object with resources grouped by type
   */
  groupResourcesByType(resources: ResourceToMigrate[]) {
    return resources.reduce((grouped, resource) => {
      const type = resource.kind || 'Unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(resource);
      return grouped;
    }, {} as Record<string, ResourceToMigrate[]>);
  },
  
  /**
   * Format resource name for display
   * @param resource The resource to format
   * @returns Formatted string with namespace and name
   */
  formatResourceName(resource: ResourceToMigrate): string {
    return resource.namespace 
      ? `${resource.namespace}/${resource.name}`
      : resource.name;
  }
};

export default MigrationService; 