import { toast } from 'sonner';
import { apiRequest, KUBERNETES_API } from './api';

/**
 * Service for handling actual EKS resource migrations between clusters
 */
export interface MigrationResource {
  kind: string;
  namespace: string;
  name: string;
}

export interface MigrationOptions {
  targetNamespace: string;
  migrateVolumes: boolean;
  preserveNodeAffinity: boolean;
}

export interface MigrationStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: string;
  resourcesMigrated: number;
  resourcesTotal: number;
  error?: string;
  migratedResources?: {
    Pod?: number;
    PersistentVolume?: number;
    Namespace?: number;
    Node?: number;
    Service?: number;
    ConfigMap?: number;
    Secret?: number;
    [key: string]: number | undefined;
  };
}

const MigrationService = {
  /**
   * Migrate resources from source to target cluster
   * 
   * @param sourceKubeconfig - Source cluster kubeconfig
   * @param targetKubeconfig - Target cluster kubeconfig
   * @param resources - Resources to migrate
   * @param options - Migration options
   * @returns Migration ID
   */
  migrateResources: async (
    sourceKubeconfig: string,
    targetKubeconfig: string, 
    resources: MigrationResource[],
    options: MigrationOptions
  ): Promise<string> => {
    try {
      // Generate a migration ID
      const migrationId = Date.now().toString();
      
      console.log(`Starting real migration ${migrationId}`);
      console.log(`Resources to migrate: ${resources.length}`);
      console.log('Migration options:', options);
      
      // Make API call to start actual migration
      const response = await apiRequest(KUBERNETES_API.MIGRATION_START, 'POST', {
        migrationId,
        sourceKubeconfig,
        targetKubeconfig,
        resources,
        options
      });
      
      // Returning migration ID for status tracking
      return migrationId;
    } catch (error) {
      console.error('Failed to start migration:', error);
      toast.error(`Failed to start migration: ${(error as Error).message}`);
      throw error;
    }
  },
  
  /**
   * Get current status of a migration
   * 
   * @param migrationId - Migration ID to check
   * @returns Migration status
   */
  getMigrationStatus: async (migrationId: string): Promise<MigrationStatus> => {
    try {
      // Get migration status from the API
      const response = await apiRequest(KUBERNETES_API.MIGRATION_STATUS_CHECK(migrationId), 'GET');
      return response;
    } catch (error) {
      console.error(`Failed to get migration status for ${migrationId}:`, error);
      throw error;
    }
  },
  
  /**
   * Cancel an ongoing migration
   * 
   * @param migrationId - Migration ID to cancel
   * @returns Success status
   */
  cancelMigration: async (migrationId: string): Promise<boolean> => {
    try {
      await apiRequest(KUBERNETES_API.MIGRATION_CANCEL(migrationId), 'POST');
      return true;
    } catch (error) {
      console.error(`Failed to cancel migration ${migrationId}:`, error);
      return false;
    }
  }
};

export default MigrationService;
