import { apiRequest } from '../utils/api';
import { KUBERNETES_API } from '../utils/api';
import { toast } from 'sonner';

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
}

export interface MigrationStatus {
  id: string;
  status: 'in-progress' | 'completed' | 'failed';
  resourcesTotal: number;
  resourcesMigrated: number;
  resourcesFailed: number;
  completedResources: ResourceToMigrate[];
  failedResources: Array<ResourceToMigrate & { error: string }>;
  currentStep: string;
  logs: Array<{ timestamp: Date; level: string; message: string }>;
  error?: string;
}

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
   * @returns Promise with migration ID for status tracking
   */
  async migrateResources(
    sourceKubeconfig: string,
    targetKubeconfig: string,
    resources: ResourceToMigrate[],
    options: MigrationOptions = {}
  ): Promise<string> {
    try {
      console.log('Starting migration for resources:', resources);
      
      const response = await apiRequest(
        KUBERNETES_API.MIGRATE_RESOURCES,
        'POST',
        {
          sourceKubeconfig,
          targetKubeconfig,
          resources,
          options
        }
      );
      
      console.log('Migration initiated with ID:', response.migrationId);
      return response.migrationId;
    } catch (error) {
      console.error('Error initiating migration:', error);
      toast.error(`Failed to start migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Check status of a migration
   * @param migrationId ID of the migration to check
   * @returns Promise with migration status
   */
  async getMigrationStatus(migrationId: string): Promise<MigrationStatus> {
    try {
      const response = await apiRequest(
        `${KUBERNETES_API.MIGRATION_STATUS}/${migrationId}`,
        'GET'
      );
      
      return response as MigrationStatus;
    } catch (error) {
      console.error('Error checking migration status:', error);
      throw error;
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