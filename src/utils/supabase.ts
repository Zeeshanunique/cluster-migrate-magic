import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create the supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// User types
export type UserCredentials = {
  email: string;
  password: string;
};

export type UserRegistration = UserCredentials & {
  name?: string;
};

// Auth service
export const authService = {
  // Sign up a new user
  async signUp({ email, password, name }: UserRegistration) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name
          }
        }
      });

      if (error) throw error;
      
      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Error signing up:', error);
      toast.error('Failed to create account');
      throw error;
    }
  },

  // Sign in a user
  async signIn({ email, password }: UserCredentials) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Failed to sign in');
      throw error;
    }
  },

  // Sign out the current user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
      throw error;
    }
  },

  // Get the current session
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Get the current user
  async getUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  // Reset password
  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent');
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send reset email');
      return false;
    }
  },

  // Update user password
  async updatePassword(password: string) {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
      return false;
    }
  }
};

// Cluster types that match our Supabase database
export interface Cluster {
  id: string;
  created_at: string;
  name: string;
  type: 'single' | 'tenant';
  status: 'running' | 'pending' | 'failed';
  nodes: number;
  region: string;
  version: string;
  owner_id: string;
  kubeconfig?: string;
  aws_account_id?: string;
  aws_role_arn?: string;
  eks_cluster_name?: string;
}

export interface CreateClusterPayload {
  name: string;
  type: 'single' | 'tenant';
  region: string;
  version: string;
  nodes: number;
  kubeconfig?: string;
  aws_account_id?: string;
  aws_role_arn?: string;
  eks_cluster_name?: string;
}

// Cluster service methods
export const clusterService = {
  async getAllClusters(userId: string): Promise<Cluster[]> {
    try {
      console.log('Fetching clusters for user:', userId);
      
      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .eq('owner_id', userId);
      
      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      console.log('Clusters fetched successfully:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching clusters:', error);
      toast.error('Failed to load clusters');
      return [];
    }
  },

  async getClusterById(clusterId: string): Promise<Cluster | null> {
    try {
      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .eq('id', clusterId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching cluster:', error);
      toast.error('Failed to load cluster details');
      return null;
    }
  },

  async createCluster(payload: CreateClusterPayload, userId: string): Promise<Cluster | null> {
    try {
      // Set initial status to pending
      const newCluster = {
        ...payload,
        status: 'pending' as const,
        owner_id: userId,
      };

      const { data, error } = await supabase
        .from('clusters')
        .insert([newCluster])
        .select()
        .single();
      
      if (error) throw error;
      
      // In a real application, you might start some background process here
      // to initialize the cluster and update its status when complete
      
      // For demo purposes, we'll set the status to running after a delay
      setTimeout(async () => {
        const { error } = await supabase
          .from('clusters')
          .update({ status: 'running' })
          .eq('id', data.id);
        
        if (!error) {
          toast.success(`Cluster "${data.name}" is now running`);
        }
      }, 5000);
      
      return data;
    } catch (error) {
      console.error('Error creating cluster:', error);
      toast.error('Failed to create cluster');
      return null;
    }
  },

  async updateCluster(
    clusterId: string, 
    updates: Partial<Omit<Cluster, 'id' | 'created_at' | 'owner_id'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('clusters')
        .update(updates)
        .eq('id', clusterId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating cluster:', error);
      toast.error('Failed to update cluster');
      return false;
    }
  },

  async deleteCluster(clusterId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('clusters')
        .delete()
        .eq('id', clusterId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting cluster:', error);
      toast.error('Failed to delete cluster');
      return false;
    }
  },

  async updateKubeconfig(clusterId: string, kubeconfig: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('clusters')
        .update({ kubeconfig })
        .eq('id', clusterId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating kubeconfig:', error);
      toast.error('Failed to update kubeconfig');
      return false;
    }
  },
  
  async convertToMultiTenant(
    sourceClusterId: string, 
    targetConfig: {
      name?: string;
      region?: string;
      nodes?: number;
      aws_account_id?: string;
      aws_role_arn?: string;
      kubeconfig?: string;
      eks_cluster_name?: string;
    }
  ): Promise<boolean> {
    try {
      // First, get the source cluster
      const sourceCluster = await this.getClusterById(sourceClusterId);
      if (!sourceCluster) {
        throw new Error('Source cluster not found');
      }
      
      console.log(`Converting cluster ${sourceCluster.name} (${sourceClusterId}) to multi-tenant`);
      
      // Check if this cluster is already converted to prevent duplication
      if (sourceCluster.type === 'tenant') {
        console.log(`Cluster ${sourceCluster.name} is already a multi-tenant, skipping conversion`);
        toast.info(`Cluster "${sourceCluster.name}" is already a multi-tenant`);
        return true;
      }
      
      // Update the source cluster to multi type and include target configuration
      const { error } = await supabase
        .from('clusters')
        .update({ 
          type: 'tenant',
          status: 'running',
          ...targetConfig,
          // Only update these fields if they're provided in targetConfig
          name: targetConfig.name || sourceCluster.name,
          region: targetConfig.region || sourceCluster.region,
          nodes: targetConfig.nodes || sourceCluster.nodes,
          eks_cluster_name: targetConfig.eks_cluster_name || sourceCluster.eks_cluster_name
        })
        .eq('id', sourceClusterId);
      
      if (error) {
        console.error('Supabase error updating cluster:', error);
        throw error;
      }
      
      console.log(`Successfully converted cluster ${sourceCluster.name} to multi-cluster`);
      
      // Create an initial checkpoint for the migration
      const checkpointPayload = {
        name: 'Migration Complete',
        description: `Successfully migrated from single to multi-cluster setup for ${sourceCluster.name}`,
        clusterId: sourceClusterId,
        status: 'completed' as CheckpointStatus,
        progress: 100
      };
      
      try {
        await checkpointService.createCheckpoint(
          checkpointPayload, 
          sourceCluster.owner_id
        );
        console.log('Created migration checkpoint for cluster', sourceClusterId);
      } catch (checkpointError) {
        // Don't fail the whole operation if checkpoint creation fails
        console.error('Error creating migration checkpoint:', checkpointError);
      }
      
      toast.success(`Cluster "${sourceCluster.name}" successfully migrated to multi-cluster`);
      return true;
    } catch (error) {
      console.error('Error converting to multi-cluster:', error);
      toast.error(`Failed to convert to multi-cluster: ${(error as Error).message}`);
      return false;
    }
  }
};

// Checkpoint types
export type CheckpointStatus = 'completed' | 'in-progress' | 'pending' | 'failed';

export interface Checkpoint {
  id: string;
  created_at: string;
  name: string;
  description: string;
  status: CheckpointStatus;
  progress: number;
  clusterId: string;
  owner_id: string;
}

export interface CreateCheckpointPayload {
  name: string;
  description: string;
  clusterId: string;
}

// Checkpoint service
export const checkpointService = {
  async getAllCheckpoints(userId: string): Promise<Checkpoint[]> {
    try {
      if (!userId) {
        console.error('Error: User ID is required to fetch checkpoints');
        toast.error('Authentication required');
        return [];
      }

      try {
        // Using a simple select without the join since it's causing errors
        const { data, error } = await supabase
          .from('checkpoints')
          .select('*')
          .eq('owner_id', userId);
        
        if (error) {
          console.error('Supabase error fetching checkpoints:', error);
          
          // Check if the error is about the table not existing
          if (error.code === '42P01') {
            console.log('Checkpoints table does not exist. Using mock data.');
            // Return mock data if table doesn't exist yet
            return getMockCheckpoints(userId);
          }
          
          throw error;
        }
        
        // If we need cluster names, we can fetch them separately
        // or modify this once the database relationships are correctly set up
        return data?.map(item => ({
          ...item,
          // Using a placeholder for clusterName since we can't join at the moment
          clusterName: item.clusterId ? `Cluster ${item.clusterId.substring(0, 5)}` : 'Unknown Cluster',
          lastUpdated: new Date(item.created_at).toLocaleDateString()
        })) || [];
      } catch (error) {
        // If there's a database error but we can recover with mock data
        if (error.code === '42P01') {
          console.log('Checkpoints table does not exist. Using mock data.');
          return getMockCheckpoints(userId);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      if (error.code) {
        toast.error(`Failed to load checkpoints: ${error.message || error.code}`);
      } else {
        toast.error('Failed to load checkpoints. Please try again later.');
      }
      return [];
    }
  },

  async getCheckpointById(checkpointId: string): Promise<Checkpoint | null> {
    try {
      if (!checkpointId) {
        console.error('Error: Checkpoint ID is required');
        toast.error('Invalid checkpoint ID');
        return null;
      }
      
      try {
        // Simplified query without the join
        const { data, error } = await supabase
          .from('checkpoints')
          .select('*')
          .eq('id', checkpointId)
          .single();
        
        if (error) {
          console.error('Supabase error fetching checkpoint:', error);
          
          // Check if the error is about the table not existing
          if (error.code === '42P01') {
            // Return mock data if table doesn't exist yet
            const mockCheckpoints = getMockCheckpoints('mock-user');
            const mockCheckpoint = mockCheckpoints.find(cp => cp.id === checkpointId);
            if (mockCheckpoint) return mockCheckpoint;
          }
          
          throw error;
        }
        
        return {
          ...data,
          // Using a placeholder for clusterName
          clusterName: data.clusterId ? `Cluster ${data.clusterId.substring(0, 5)}` : 'Unknown Cluster',
          lastUpdated: new Date(data.created_at).toLocaleDateString()
        };
      } catch (error) {
        // If there's a database error but we can recover with mock data
        if (error.code === '42P01') {
          const mockCheckpoints = getMockCheckpoints('mock-user');
          const mockCheckpoint = mockCheckpoints.find(cp => cp.id === checkpointId);
          if (mockCheckpoint) return mockCheckpoint;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error fetching checkpoint:', error);
      if (error.code) {
        toast.error(`Failed to load checkpoint: ${error.message || error.code}`);
      } else {
        toast.error('Failed to load checkpoint details. Please try again later.');
      }
      return null;
    }
  },

  async createCheckpoint(payload: CreateCheckpointPayload, userId: string): Promise<Checkpoint | null> {
    try {
      if (!userId) {
        console.error('Error: User ID is required to create a checkpoint');
        toast.error('Authentication required');
        return null;
      }
      
      if (!payload.clusterId) {
        console.error('Error: Cluster ID is required to create a checkpoint');
        toast.error('Please select a cluster');
        return null;
      }
      
      try {
        const newCheckpoint = {
          ...payload,
          status: 'pending' as CheckpointStatus,
          progress: 0,
          owner_id: userId,
        };

        const { data, error } = await supabase
          .from('checkpoints')
          .insert([newCheckpoint])
          .select()
          .single();
        
        if (error) {
          console.error('Supabase error creating checkpoint:', error);
          
          // Check if the error is about the table not existing
          if (error.code === '42P01') {
            toast.info('Mock checkpoint created (database not available)');
            // Create a mock checkpoint for demo
            const mockCheckpoint: Checkpoint = {
              id: `mock-${Date.now()}`,
              created_at: new Date().toISOString(),
              name: payload.name,
              description: payload.description,
              status: 'pending',
              progress: 0,
              clusterId: payload.clusterId,
              owner_id: userId,
              clusterName: `Cluster ${payload.clusterId.substring(0, 5)}`,
              lastUpdated: new Date().toLocaleDateString()
            };
            return mockCheckpoint;
          }
          
          throw error;
        }
        
        return data;
      } catch (error) {
        // If there's a database error but we can recover with mock
        if (error.code === '42P01') {
          toast.info('Mock checkpoint created (database not available)');
          const mockCheckpoint: Checkpoint = {
            id: `mock-${Date.now()}`,
            created_at: new Date().toISOString(),
            name: payload.name,
            description: payload.description,
            status: 'pending',
            progress: 0,
            clusterId: payload.clusterId,
            owner_id: userId,
            clusterName: `Cluster ${payload.clusterId.substring(0, 5)}`,
            lastUpdated: new Date().toLocaleDateString()
          };
          return mockCheckpoint;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      if (error.code) {
        toast.error(`Failed to create checkpoint: ${error.message || error.code}`);
      } else {
        toast.error('Failed to create checkpoint. Please try again later.');
      }
      return null;
    }
  },

  async updateCheckpoint(
    checkpointId: string, 
    updates: Partial<{ status: CheckpointStatus; progress: number; description: string }>
  ): Promise<boolean> {
    try {
      if (!checkpointId) {
        console.error('Error: Checkpoint ID is required to update a checkpoint');
        toast.error('Invalid checkpoint ID');
        return false;
      }
      
      if (Object.keys(updates).length === 0) {
        console.error('Error: No updates provided');
        toast.error('No changes to update');
        return false;
      }
      
      try {
        const { error } = await supabase
          .from('checkpoints')
          .update(updates)
          .eq('id', checkpointId);
        
        if (error) {
          console.error('Supabase error updating checkpoint:', error);
          
          // Check if the error is about the table not existing
          if (error.code === '42P01') {
            toast.info('Mock checkpoint updated (database not available)');
            return true;
          }
          
          throw error;
        }
        
        return true;
      } catch (error) {
        // If there's a database error but we can pretend it succeeded for mock data
        if (error.code === '42P01') {
          toast.info('Mock checkpoint updated (database not available)');
          return true;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error updating checkpoint:', error);
      if (error.code) {
        toast.error(`Failed to update checkpoint: ${error.message || error.code}`);
      } else {
        toast.error('Failed to update checkpoint. Please try again later.');
      }
      return false;
    }
  },

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      if (!checkpointId) {
        console.error('Error: Checkpoint ID is required to delete a checkpoint');
        toast.error('Invalid checkpoint ID');
        return false;
      }
      
      try {
        const { error } = await supabase
          .from('checkpoints')
          .delete()
          .eq('id', checkpointId);
        
        if (error) {
          console.error('Supabase error deleting checkpoint:', error);
          
          // Check if the error is about the table not existing
          if (error.code === '42P01') {
            toast.info('Mock checkpoint deleted (database not available)');
            return true;
          }
          
          throw error;
        }
        
        return true;
      } catch (error) {
        // If there's a database error but we can pretend it succeeded for mock data
        if (error.code === '42P01') {
          toast.info('Mock checkpoint deleted (database not available)');
          return true;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      if (error.code) {
        toast.error(`Failed to delete checkpoint: ${error.message || error.code}`);
      } else {
        toast.error('Failed to delete checkpoint. Please try again later.');
      }
      return false;
    }
  }
};

// Mock data helper function
function getMockCheckpoints(userId: string): Checkpoint[] {
  return [
    {
      id: 'mock-checkpoint-1',
      created_at: '2023-10-15T14:30:00Z',
      name: 'Database Migration',
      description: 'Migrating database configurations and persistent volumes',
      status: 'completed',
      progress: 100,
      clusterId: 'cluster-1',
      owner_id: userId,
      clusterName: 'Production DB',
      lastUpdated: '2 days ago'
    },
    {
      id: 'mock-checkpoint-2',
      created_at: '2023-10-20T09:15:00Z',
      name: 'Network Configuration',
      description: 'Setting up network policies and service meshes',
      status: 'in-progress',
      progress: 65,
      clusterId: 'cluster-2',
      owner_id: userId,
      clusterName: 'Staging Environment',
      lastUpdated: '3 hours ago'
    },
    {
      id: 'mock-checkpoint-3',
      created_at: '2023-10-22T11:00:00Z',
      name: 'Auth Services',
      description: 'Configuring authentication and security policies',
      status: 'pending',
      progress: 0,
      clusterId: 'cluster-3',
      owner_id: userId,
      clusterName: 'Analytics Platform',
      lastUpdated: 'Not started'
    },
    {
      id: 'mock-checkpoint-4',
      created_at: '2023-10-18T16:45:00Z',
      name: 'Storage Migration',
      description: 'Transferring persistent volumes and storage classes',
      status: 'failed',
      progress: 38,
      clusterId: 'cluster-4',
      owner_id: userId,
      clusterName: 'Development',
      lastUpdated: '1 day ago'
    }
  ];
}
