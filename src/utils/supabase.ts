
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Cluster types that match our Supabase database
export interface Cluster {
  id: string;
  created_at: string;
  name: string;
  type: 'single' | 'multi';
  status: 'running' | 'pending' | 'failed';
  nodes: number;
  region: string;
  version: string;
  owner_id: string;
  kubeconfig?: string;
  aws_account_id?: string;
  aws_role_arn?: string;
}

export interface CreateClusterPayload {
  name: string;
  type: 'single' | 'multi';
  region: string;
  version: string;
  nodes: number;
  kubeconfig?: string;
  aws_account_id?: string;
  aws_role_arn?: string;
}

// Cluster service methods
export const clusterService = {
  async getAllClusters(userId: string): Promise<Cluster[]> {
    try {
      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .eq('owner_id', userId);
      
      if (error) throw error;
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
  }
};
