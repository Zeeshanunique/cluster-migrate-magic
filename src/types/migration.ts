import { Cluster } from './cluster';
import { KubernetesResource } from './resources';

export type MigrationStatus = 
  | 'pending' 
  | 'in-progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type ResourceSelectionStatus = 
  | 'selected' 
  | 'excluded' 
  | 'modified';

export interface ResourceSelection {
  resource: KubernetesResource;
  status: ResourceSelectionStatus;
  modifications?: Record<string, any>;
}

export interface NamespaceSelection {
  namespace: string;
  isSelected: boolean;
  resources: ResourceSelection[];
}

export interface MigrationPlan {
  id?: string;
  name: string;
  sourceCluster: Cluster;
  targetCluster: Cluster;
  selectedNamespaces: NamespaceSelection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Migration {
  id: string;
  plan: MigrationPlan;
  status: MigrationStatus;
  progress?: number;
  startTime?: string;
  endTime?: string;
  logs?: MigrationLog[];
  errors?: MigrationError[];
}

export interface MigrationLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  resourceName?: string;
  resourceKind?: string;
  namespace?: string;
}

export interface MigrationError {
  timestamp: string;
  message: string;
  resourceName?: string;
  resourceKind?: string;
  namespace?: string;
  details?: any;
}

export interface MigrationOptions {
  includeConfigs: boolean;
  includeSecrets: boolean;
  includePersistentVolumes: boolean;
  dryRun: boolean;
  forceUpdate: boolean;
  skipValidation: boolean;
} 