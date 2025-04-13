export interface Cluster {
  id: string;
  name: string;
  provider: string;
  region?: string;
  kubeconfig: string;
  status?: 'connected' | 'disconnected' | 'error';
  createdAt?: string;
  updatedAt?: string;
} 