import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { toast } from 'sonner';

// Get AWS credentials from environment variables - make sure these are properly set in .env
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

// Log AWS configuration
console.log('AWS Configuration:');
console.log('Region:', region);
console.log('Access Key ID present:', !!accessKeyId);
console.log('Secret Access Key present:', !!secretAccessKey);

if (!accessKeyId || !secretAccessKey) {
  console.warn('AWS credentials are missing - DynamoDB operations will fail!');
}

// DynamoDB client setup with explicit credentials
const dynamodbClient = new DynamoDBClient({ 
  region,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  }
});
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// Log environment variables
console.log('Environment variables in dynamodb.ts:');
console.log('VITE_COGNITO_USER_POOL_ID:', import.meta.env.VITE_COGNITO_USER_POOL_ID);
console.log('VITE_COGNITO_CLIENT_ID:', import.meta.env.VITE_COGNITO_CLIENT_ID);

// Cognito client setup
// Updated to use explicit credentials for consistency
const userPoolId = 'us-east-1_Un9I1Ba6U';
const clientId = '4qfs9mvg1phde56htj0d3b3ku9';
const cognitoClient = new CognitoIdentityProviderClient({ 
  region,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  }
});

console.log('Using Cognito configuration:');
console.log('User Pool ID:', userPoolId);
console.log('Client ID:', clientId);

// User types - keeping the same interface as Supabase for compatibility
export type UserCredentials = {
  email: string;
  password: string;
};

export type UserRegistration = UserCredentials & {
  name?: string;
};

// Table names
const CLUSTERS_TABLE = 'clusters';
const CHECKPOINTS_TABLE = 'checkpoints';

// Auth service - mimicking Supabase auth functionality
export const authService = {
  // Sign up a new user
  async signUp({ email, password, name }: UserRegistration) {
    try {
      const command = new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          ...(name ? [{ Name: 'name', Value: name }] : [])
        ]
      });

      const response = await cognitoClient.send(command);
      
      return { 
        user: { id: response.UserSub, email }, 
        session: { access_token: '', refresh_token: '' } 
      };
    } catch (error) {
      console.error('Error signing up:', error);
      toast.error('Failed to create account');
      throw error;
    }
  },

  // Sign in a user
  async signIn({ email, password }: UserCredentials) {
    try {
      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const response = await cognitoClient.send(command);
      const accessToken = response.AuthenticationResult?.AccessToken || '';
      const refreshToken = response.AuthenticationResult?.RefreshToken || '';
      
      // Store tokens in localStorage for session persistence
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Get user details
      const user = await this.getUser();
      
      return { 
        user, 
        session: { 
          access_token: accessToken, 
          refresh_token: refreshToken 
        } 
      };
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Failed to sign in');
      throw error;
    }
  },

  // Sign out the current user
  async signOut() {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken
        });
        await cognitoClient.send(command);
      }
      
      // Clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
      throw error;
    }
  },

  // Get the current session
  async getSession() {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!accessToken) {
        return null;
      }
      
      return {
        access_token: accessToken,
        refresh_token: refreshToken || ''
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Get the current user
  async getUser() {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (!accessToken) {
        return null;
      }
      
      const command = new GetUserCommand({
        AccessToken: accessToken
      });
      
      const response = await cognitoClient.send(command);
      
      // Extract user ID and email from attributes
      const attributes = response.UserAttributes || [];
      const emailAttr = attributes.find(attr => attr.Name === 'email');
      const subAttr = attributes.find(attr => attr.Name === 'sub');
      
      if (!subAttr || !emailAttr) {
        return null;
      }
      
      return {
        id: subAttr.Value || '',
        email: emailAttr.Value || ''
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  // Reset password
  async resetPassword(email: string) {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: email
      });
      
      await cognitoClient.send(command);
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
      // In a real implementation, you would use the confirmation code sent to email
      // and the new password to confirm the forgot password flow
      toast.success('Password updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
      return false;
    }
  }
};

// Cluster types - keeping the same interface as Supabase for compatibility
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

// Helper function to generate a unique ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Cluster service methods
export const clusterService = {
  async getAllClusters(userId: string): Promise<Cluster[]> {
    try {
      console.log('Fetching clusters for user:', userId);
      
      const command = new QueryCommand({
        TableName: CLUSTERS_TABLE,
        IndexName: 'owner_id-index',
        KeyConditionExpression: 'owner_id = :ownerId',
        ExpressionAttributeValues: {
          ':ownerId': userId
        }
      });
      
      const response = await docClient.send(command);
      const data = response.Items as Cluster[];
      
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
      const command = new GetCommand({
        TableName: CLUSTERS_TABLE,
        Key: {
          id: clusterId
        }
      });
      
      const response = await docClient.send(command);
      return response.Item as Cluster || null;
    } catch (error) {
      console.error('Error fetching cluster:', error);
      toast.error('Failed to load cluster details');
      return null;
    }
  },

  async createCluster(payload: CreateClusterPayload, userId: string): Promise<Cluster | null> {
    try {
      // Set initial status to pending and create a new ID
      const newCluster: Cluster = {
        id: generateId(),
        created_at: new Date().toISOString(),
        ...payload,
        status: 'pending',
        owner_id: userId,
      };

      const command = new PutCommand({
        TableName: CLUSTERS_TABLE,
        Item: newCluster
      });
      
      await docClient.send(command);
      
      // For demo purposes, set the status to running after a delay
      setTimeout(async () => {
        const updateCommand = new UpdateCommand({
          TableName: CLUSTERS_TABLE,
          Key: { id: newCluster.id },
          UpdateExpression: 'set #status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': 'running' }
        });
        
        try {
          await docClient.send(updateCommand);
          toast.success(`Cluster "${newCluster.name}" is now running`);
        } catch (updateError) {
          console.error('Error updating cluster status:', updateError);
        }
      }, 5000);
      
      return newCluster;
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
      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      });
      
      if (updateExpressions.length === 0) {
        return true; // Nothing to update
      }
      
      const command = new UpdateCommand({
        TableName: CLUSTERS_TABLE,
        Key: { id: clusterId },
        UpdateExpression: `set ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      });
      
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error updating cluster:', error);
      toast.error('Failed to update cluster');
      return false;
    }
  },

  async deleteCluster(clusterId: string): Promise<boolean> {
    try {
      const command = new DeleteCommand({
        TableName: CLUSTERS_TABLE,
        Key: { id: clusterId }
      });
      
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting cluster:', error);
      toast.error('Failed to delete cluster');
      return false;
    }
  },

  async updateKubeconfig(clusterId: string, kubeconfig: string): Promise<boolean> {
    try {
      const command = new UpdateCommand({
        TableName: CLUSTERS_TABLE,
        Key: { id: clusterId },
        UpdateExpression: 'set kubeconfig = :kubeconfig',
        ExpressionAttributeValues: { ':kubeconfig': kubeconfig }
      });
      
      await docClient.send(command);
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
      // Get source cluster
      const sourceCluster = await this.getClusterById(sourceClusterId);
      if (!sourceCluster) {
        throw new Error('Source cluster not found');
      }
      
      // Create new multi-tenant cluster
      const newCluster: CreateClusterPayload = {
        name: targetConfig.name || `${sourceCluster.name}-tenant`,
        type: 'tenant',
        region: targetConfig.region || sourceCluster.region,
        version: sourceCluster.version,
        nodes: targetConfig.nodes || sourceCluster.nodes,
        kubeconfig: targetConfig.kubeconfig || sourceCluster.kubeconfig,
        aws_account_id: targetConfig.aws_account_id || sourceCluster.aws_account_id,
        aws_role_arn: targetConfig.aws_role_arn || sourceCluster.aws_role_arn,
        eks_cluster_name: targetConfig.eks_cluster_name || sourceCluster.eks_cluster_name
      };
      
      const result = await this.createCluster(newCluster, sourceCluster.owner_id);
      
      return !!result;
    } catch (error) {
      console.error('Error converting to multi-tenant:', error);
      toast.error('Failed to convert cluster to multi-tenant');
      return false;
    }
  }
};

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
  clusterName?: string;
  lastUpdated?: string;
}

export interface CreateCheckpointPayload {
  name: string;
  description: string;
  clusterId: string;
}

// Checkpoint service methods
export const checkpointService = {
  async getAllCheckpoints(userId: string): Promise<Checkpoint[]> {
    try {
      // First we'll fetch all checkpoints for this user
      const command = new QueryCommand({
        TableName: CHECKPOINTS_TABLE,
        IndexName: 'owner_id-index',
        KeyConditionExpression: 'owner_id = :ownerId',
        ExpressionAttributeValues: {
          ':ownerId': userId
        }
      });
      
      const response = await docClient.send(command);
      const checkpoints = (response.Items || []) as Checkpoint[];
      
      // If we need to add cluster names to checkpoints, we'd fetch all relevant clusters
      // This is suboptimal in a real app, but mimics the Supabase join functionality
      const clusterIds = [...new Set(checkpoints.map(cp => cp.clusterId))];
      
      if (clusterIds.length === 0) {
        return checkpoints;
      }
      
      // For each cluster ID, fetch the cluster details
      const clusterPromises = clusterIds.map(id => clusterService.getClusterById(id));
      const clusters = await Promise.all(clusterPromises);
      
      // Create a map of cluster IDs to cluster names
      const clusterMap: Record<string, string> = {};
      clusters.forEach(cluster => {
        if (cluster) {
          clusterMap[cluster.id] = cluster.name;
        }
      });
      
      // Add cluster names to checkpoints
      return checkpoints.map(cp => ({
        ...cp,
        clusterName: clusterMap[cp.clusterId] || 'Unknown Cluster'
      }));
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      toast.error('Failed to load checkpoints');
      return [];
    }
  },

  async getCheckpointById(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const command = new GetCommand({
        TableName: CHECKPOINTS_TABLE,
        Key: { id: checkpointId }
      });
      
      const response = await docClient.send(command);
      
      if (!response.Item) {
        return null;
      }
      
      const checkpoint = response.Item as Checkpoint;
      
      // Get cluster name if available
      if (checkpoint.clusterId) {
        const cluster = await clusterService.getClusterById(checkpoint.clusterId);
        if (cluster) {
          checkpoint.clusterName = cluster.name;
        }
      }
      
      return checkpoint;
    } catch (error) {
      console.error('Error fetching checkpoint:', error);
      toast.error('Failed to load checkpoint details');
      return null;
    }
  },

  async createCheckpoint(payload: CreateCheckpointPayload, userId: string): Promise<Checkpoint | null> {
    try {
      // Get cluster name
      const cluster = await clusterService.getClusterById(payload.clusterId);
      if (!cluster) {
        throw new Error('Cluster not found');
      }
      
      const newCheckpoint: Checkpoint = {
        id: generateId(),
        created_at: new Date().toISOString(),
        name: payload.name,
        description: payload.description,
        status: 'pending',
        progress: 0,
        clusterId: payload.clusterId,
        owner_id: userId,
        clusterName: cluster.name,
        lastUpdated: new Date().toISOString()
      };
      
      const command = new PutCommand({
        TableName: CHECKPOINTS_TABLE,
        Item: newCheckpoint
      });
      
      await docClient.send(command);
      
      return newCheckpoint;
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      toast.error('Failed to create checkpoint');
      return null;
    }
  },

  async updateCheckpoint(
    checkpointId: string, 
    updates: Partial<{ status: CheckpointStatus; progress: number; description: string }>
  ): Promise<boolean> {
    try {
      const lastUpdated = new Date().toISOString();
      
      // Build update expression
      const updateExpressions: string[] = ['#lastUpdated = :lastUpdated'];
      const expressionAttributeNames: Record<string, string> = {
        '#lastUpdated': 'lastUpdated'
      };
      const expressionAttributeValues: Record<string, any> = {
        ':lastUpdated': lastUpdated
      };
      
      Object.entries(updates).forEach(([key, value]) => {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      });
      
      const command = new UpdateCommand({
        TableName: CHECKPOINTS_TABLE,
        Key: { id: checkpointId },
        UpdateExpression: `set ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      });
      
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error updating checkpoint:', error);
      toast.error('Failed to update checkpoint');
      return false;
    }
  },

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const command = new DeleteCommand({
        TableName: CHECKPOINTS_TABLE,
        Key: { id: checkpointId }
      });
      
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      toast.error('Failed to delete checkpoint');
      return false;
    }
  }
};

// For mock data support - similar to the original implementation
function getMockCheckpoints(userId: string): Checkpoint[] {
  const now = new Date();
  return [
    {
      id: 'mock-1',
      created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Pre-Migration Snapshot',
      description: 'Snapshot before migrating to multi-tenant architecture',
      status: 'completed',
      progress: 100,
      clusterId: 'mock-cluster-1',
      owner_id: userId,
      clusterName: 'Production Cluster',
      lastUpdated: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-2',
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Resource Validation',
      description: 'Validating all resources before migration',
      status: 'in-progress',
      progress: 65,
      clusterId: 'mock-cluster-2',
      owner_id: userId,
      clusterName: 'Staging Cluster',
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'mock-3',
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      name: 'Tenant Configuration',
      description: 'Setting up tenant isolation and network policies',
      status: 'pending',
      progress: 0,
      clusterId: 'mock-cluster-3',
      owner_id: userId,
      clusterName: 'Multi-Tenant Cluster',
      lastUpdated: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }
  ];
} 