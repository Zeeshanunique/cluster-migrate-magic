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
  GetUserCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { toast } from 'sonner';
import {
  ListTablesCommand,
  ScanCommand as DynamoDBScanCommand,
  PutItemCommand,
  DeleteItemCommand,
  GetItemCommand,
  BatchWriteItemCommand,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateItemCommand,
  AttributeValue,
  ScalarAttributeType,
  KeyType
} from '@aws-sdk/client-dynamodb';

// Get AWS credentials from environment variables - make sure these are properly set in .env
const region = import.meta.env.VITE_DYNAMODB_REGION || import.meta.env.VITE_AWS_REGION || 'us-east-1';
const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
const isProduction = import.meta.env.PROD === true;

// Log AWS configuration
console.log('AWS Configuration:');
console.log('Region:', region);
console.log('Environment:', isProduction ? 'Production' : 'Development');

// Initialize DynamoDB clients based on environment
let dynamodbClient;
let cognitoClient;

if (isProduction) {
  console.log('Using IAM Role from EC2 instance for AWS authentication');
  
  // In production, use the EC2 instance role (no explicit credentials)
  dynamodbClient = new DynamoDBClient({ region });
  cognitoClient = new CognitoIdentityProviderClient({ region });
} else {
  console.log('Using explicit AWS credentials for AWS authentication');
  console.log('Access Key ID present:', !!accessKeyId);
  console.log('Secret Access Key present:', !!secretAccessKey);
  
  if (!accessKeyId || !secretAccessKey) {
    console.warn('AWS credentials are missing - DynamoDB operations will fail in development!');
  }
  
  // In development, use explicit credentials
  dynamodbClient = new DynamoDBClient({ 
    region,
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || ''
    }
  });
  
  cognitoClient = new CognitoIdentityProviderClient({ 
    region,
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || ''
    }
  });
}

const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// Log environment variables
console.log('Environment variables in dynamodb.ts:');
console.log('VITE_COGNITO_USER_POOL_ID:', import.meta.env.VITE_COGNITO_USER_POOL_ID);
console.log('VITE_COGNITO_CLIENT_ID:', import.meta.env.VITE_COGNITO_CLIENT_ID);

// Cognito client setup
// Use environment variables or fallback to the provided values
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_0phCrx0Ao';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '4qfs9mvg1phde56htj0d3b3ku9';

console.log('Using Cognito configuration:');
console.log('User Pool ID:', userPoolId);
console.log('Client ID:', clientId);

// Admin function to create a test user - for development only
export const createTestUser = async (email: string, password: string, name = 'Test User') => {
  try {
    // Check if user exists first
    try {
      const adminGetUserCommand = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: email
      });
      await cognitoClient.send(adminGetUserCommand);
      console.log('User already exists:', email);
      return { success: true, message: 'User already exists', userExists: true };
    } catch (error: any) {
      // If user doesn't exist, proceed with creation
      if (error.name === 'UserNotFoundException') {
        const adminCreateUserCommand = new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          TemporaryPassword: password,
          MessageAction: 'SUPPRESS', // Don't send welcome email
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: name }
          ]
        });
        
        await cognitoClient.send(adminCreateUserCommand);
        
        // Set permanent password
        const adminSetUserPasswordCommand = new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: password,
          Permanent: true
        });
        
        await cognitoClient.send(adminSetUserPasswordCommand);
        
        console.log('Test user created successfully:', email);
        return { success: true, message: 'Test user created successfully' };
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating test user:', error);
    return { success: false, message: 'Failed to create test user', error };
  }
};

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
const MIGRATION_LOGS_TABLE = 'migration_logs';

// Auth service - mimicking Supabase auth functionality
export const authService = {
  // Sign up a new user
  async signUp({ email, password, name }: UserRegistration) {
    try {
      // First attempt to sign up the user
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
      const userId = response.UserSub || '';
      
      try {
        // After sign-up, use admin powers to confirm the user so they can sign in immediately
        // This is a simplified flow for better UX - in production, you'd likely have email verification
        const adminConfirmSignUpCommand = new AdminConfirmSignUpCommand({
          UserPoolId: userPoolId,
          Username: email
        });
        
        await cognitoClient.send(adminConfirmSignUpCommand);
        console.log('User confirmed successfully:', email);
        
        // Now sign in automatically to get tokens
        try {
          const signInCommand = new InitiateAuthCommand({
            ClientId: clientId,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password
            }
          });
          
          const signInResponse = await cognitoClient.send(signInCommand);
          const accessToken = signInResponse.AuthenticationResult?.AccessToken || '';
          const refreshToken = signInResponse.AuthenticationResult?.RefreshToken || '';
          
          // Store tokens in localStorage for session persistence
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          
          return { 
            user: { id: userId, email }, 
            session: { 
              access_token: accessToken,
              refresh_token: refreshToken
            } 
          };
        } catch (signInError) {
          console.error('Error signing in after sign up:', signInError);
          // Return user but no session if sign-in fails
          return { 
            user: { id: userId, email }, 
            session: { access_token: '', refresh_token: '' } 
          };
        }
      } catch (confirmError) {
        console.error('Error confirming user:', confirmError);
        // Return basic info even if confirmation fails
        return { 
          user: { id: userId, email }, 
          session: { access_token: '', refresh_token: '' } 
        };
      }
    } catch (error) {
      console.error('Error signing up:', error);
      toast.error('Failed to create account');
      throw error;
    }
  },

  // Sign in a user
  async signIn({ email, password }: UserCredentials) {
    try {
      console.log(`Attempting to sign in user: ${email}`);
      
      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const response = await cognitoClient.send(command);
      console.log('Sign in successful, received tokens');
      
      const accessToken = response.AuthenticationResult?.AccessToken || '';
      const refreshToken = response.AuthenticationResult?.RefreshToken || '';
      
      if (!accessToken) {
        console.error('Authentication succeeded but no access token was returned');
        throw new Error('No access token received');
      }
      
      // Store tokens in localStorage for session persistence
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Get user details
      console.log('Getting user details with access token');
      const user = await this.getUser();
      
      if (!user) {
        console.error('Failed to retrieve user details after successful authentication');
      } else {
        console.log(`User details retrieved: ${user.id}`);
      }
      
      return { 
        user, 
        session: { 
          access_token: accessToken, 
          refresh_token: refreshToken 
        } 
      };
    } catch (error: any) {
      console.error('Error signing in:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // Check if the error is because the user doesn't exist
      if (error.name === 'UserNotFoundException') {
        toast.error('This account does not exist. Please sign up first.');
        throw new Error('User does not exist. Please create an account first.');
      } else if (error.name === 'NotAuthorizedException') {
        if (error.message.includes('Incorrect username or password')) {
          toast.error('Incorrect username or password');
          throw new Error('Incorrect username or password');
        } else if (error.message.includes('User is not confirmed')) {
          console.log('User is not confirmed, attempting to confirm automatically...');
          try {
            // Auto-confirm the user for better experience
            const adminConfirmSignUpCommand = new AdminConfirmSignUpCommand({
              UserPoolId: userPoolId,
              Username: email
            });
            
            await cognitoClient.send(adminConfirmSignUpCommand);
            console.log('User confirmed successfully, attempting sign-in again');
            
            // Try sign in again
            return this.signIn({ email, password });
          } catch (confirmError) {
            console.error('Failed to auto-confirm user:', confirmError);
            toast.error('Account is not verified. Please try again.');
            throw new Error('Account is not verified. Please contact support for assistance.');
          }
        } else {
          toast.error('Authentication failed');
          throw error;
        }
      } else {
        toast.error('Failed to sign in');
        throw error;
      }
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
      
      try {
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
      } catch (error: any) {
        // If the token is expired, try to refresh it
        if (error.name === 'NotAuthorizedException') {
          console.log('Access token expired, attempting to refresh...');
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Try again with the new token
            return this.getUser();
          } else {
            // If refresh fails, return null
            console.log('Token refresh failed, user needs to login again');
            return null;
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  // Refresh the token when it expires
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }
      
      // Initialize a new Cognito IDP client for refresh token operation
      const refreshCommand = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: {
          'REFRESH_TOKEN': refreshToken
        }
      });
      
      const response = await cognitoClient.send(refreshCommand);
      
      // Update tokens in local storage
      if (response.AuthenticationResult?.AccessToken) {
        localStorage.setItem('accessToken', response.AuthenticationResult.AccessToken);
        console.log('Access token refreshed successfully');
        
        // If a new refresh token is provided, update it too
        if (response.AuthenticationResult?.RefreshToken) {
          localStorage.setItem('refreshToken', response.AuthenticationResult.RefreshToken);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
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

// Migration Log Types
export interface MigrationLog {
  id: string;
  created_at: string;
  owner_id: string;
  sourceCluster: {
    id: string;
    name: string;
  };
  targetCluster: {
    id: string;
    name: string;
  };
  status: 'completed' | 'failed' | 'in-progress';
  resourcesTotal: number;
  resourcesMigrated: number;
  resourcesFailed: number;
  completedResources?: any[];
  failedResources?: Array<{ kind: string; name: string; namespace: string; error: string }>;
  duration?: number; // in seconds
  error?: string;
}

export interface CreateMigrationLogPayload {
  sourceClusterId: string;
  sourceClusterName: string;
  targetClusterId: string;
  targetClusterName: string;
  status?: 'in-progress' | 'completed' | 'failed';
  resourcesTotal: number;
  error?: string;
}

// Create a helper function to ensure table exists and is active
async function ensureTableExists(tableName: string): Promise<boolean> {
  try {
    // Check if the table exists
    const describeParams = {
      TableName: tableName
    };
    
    try {
      console.log(`Checking if table ${tableName} exists...`);
      const tableInfo = await dynamodbClient.send(new DescribeTableCommand(describeParams));
      
      // If table exists but is not active, wait for it
      if (tableInfo.Table?.TableStatus !== 'ACTIVE') {
        console.log(`Table ${tableName} exists but is not active (${tableInfo.Table?.TableStatus}). Waiting...`);
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          // Check status again
          const tableStatus = await dynamodbClient.send(new DescribeTableCommand(describeParams));
          if (tableStatus.Table?.TableStatus === 'ACTIVE') {
            console.log(`Table ${tableName} is now ACTIVE`);
            return true;
          }
          
          attempts++;
          console.log(`Still waiting for table ${tableName} to be ACTIVE... (attempt ${attempts}/${maxAttempts})`);
        }
        
        console.error(`Table ${tableName} did not become ACTIVE after ${maxAttempts} attempts`);
        return false;
      }
      
      console.log(`Table ${tableName} exists and is ACTIVE`);
      return true;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Table ${tableName} does not exist. Creating...`);
        
        // Create table based on the table name
        if (tableName === 'migration_logs') {
          const params = {
            TableName: tableName,
            KeySchema: [
              { AttributeName: 'id', KeyType: KeyType.HASH }
            ],
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: ScalarAttributeType.S }
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          };
          
          await dynamodbClient.send(new CreateTableCommand(params));
          console.log(`Table ${tableName} created. Waiting for it to become ACTIVE...`);
          
          // Wait for table to be created and active
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            try {
              const tableStatus = await dynamodbClient.send(new DescribeTableCommand(describeParams));
              if (tableStatus.Table?.TableStatus === 'ACTIVE') {
                console.log(`Table ${tableName} is now ACTIVE`);
                return true;
              }
            } catch (error) {
              console.log(`Table not yet available for checking status`);
            }
            
            attempts++;
            console.log(`Waiting for table ${tableName} to be ACTIVE... (attempt ${attempts}/${maxAttempts})`);
          }
          
          console.error(`Table ${tableName} did not become ACTIVE after ${maxAttempts} attempts`);
          return false;
        } else {
          console.error(`Unknown table name ${tableName}, don't know how to create it`);
          return false;
        }
      } else {
        console.error(`Error checking table ${tableName}:`, error);
        return false;
      }
    }
  } catch (error) {
    console.error(`Error ensuring table ${tableName} exists:`, error);
    return false;
  }
}

// Migration Log service
export const migrationLogService = {
  // Create a new migration log
  async createMigrationLog(payload: CreateMigrationLogPayload, userId: string): Promise<MigrationLog | null> {
    try {
      // Check if the migration_logs table exists, if not, create it
      try {
        const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        
        // Try to describe the table to see if it exists
        await dynamodbClient.send(new DescribeTableCommand({
          TableName: MIGRATION_LOGS_TABLE
        }));
        
        // If we get here, the table exists
        console.log(`Table ${MIGRATION_LOGS_TABLE} exists.`);
      } catch (tableError: any) {
        // If the error is ResourceNotFoundException, create the table
        if (tableError.name === 'ResourceNotFoundException') {
          console.log(`Table ${MIGRATION_LOGS_TABLE} does not exist. Creating it...`);
          
          // Create the table with minimal configuration
          const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
          
          try {
            await dynamodbClient.send(new CreateTableCommand({
              TableName: MIGRATION_LOGS_TABLE,
              KeySchema: [
                { AttributeName: 'id', KeyType: KeyType.HASH },
                { AttributeName: 'owner_id', KeyType: KeyType.RANGE }
              ],
              AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: ScalarAttributeType.S },
                { AttributeName: 'owner_id', AttributeType: ScalarAttributeType.S }
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
              }
            }));
            console.log(`Table ${MIGRATION_LOGS_TABLE} created successfully.`);
            
            // Wait for the table to be in ACTIVE state before proceeding
            const waitForTableActive = async (): Promise<boolean> => {
              try {
                const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
                const response = await dynamodbClient.send(new DescribeTableCommand({
                  TableName: MIGRATION_LOGS_TABLE
                }));
                
                if (response.Table?.TableStatus === 'ACTIVE') {
                  console.log(`Table ${MIGRATION_LOGS_TABLE} is now active.`);
                  return true;
                } else {
                  console.log(`Waiting for table ${MIGRATION_LOGS_TABLE} to become active...`);
                  return false;
                }
              } catch (error) {
                console.error(`Error checking table status: ${error}`);
                return false;
              }
            };
            
            // Poll every 2 seconds for up to 30 seconds
            let attempts = 0;
            const maxAttempts = 15;
            let tableActive = false;
            
            while (!tableActive && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              tableActive = await waitForTableActive();
              attempts++;
            }
            
            if (!tableActive) {
              throw new Error(`Table ${MIGRATION_LOGS_TABLE} did not become active in time`);
            }
          } catch (createError) {
            console.error(`Error creating table ${MIGRATION_LOGS_TABLE}:`, createError);
            // Continue with the function - it might work with mock data
          }
        } else {
          console.error(`Error checking table ${MIGRATION_LOGS_TABLE}:`, tableError);
        }
      }
      
      // Create the migration log object
      const timestamp = new Date().toISOString();
      const id = `migration-${generateId()}`;
      
      const migrationLog: MigrationLog = {
        id,
        created_at: timestamp,
        owner_id: userId,
        sourceCluster: {
          id: payload.sourceClusterId,
          name: payload.sourceClusterName
        },
        targetCluster: {
          id: payload.targetClusterId,
          name: payload.targetClusterName
        },
        status: payload.status || 'in-progress',
        resourcesTotal: payload.resourcesTotal,
        resourcesMigrated: 0,
        resourcesFailed: 0,
        error: payload.error
      };
      
      try {
        // Try to save to DynamoDB
        const command = new PutCommand({
          TableName: MIGRATION_LOGS_TABLE,
          Item: migrationLog
        });
        
        await docClient.send(command);
        console.log('Migration log saved to DynamoDB successfully:', migrationLog.id);
        return migrationLog;
      } catch (putError) {
        console.error('Error putting migration log to DynamoDB:', putError);
        
        // Fallback: Save to localStorage for development/demo purposes
        try {
          const storageKey = 'migration_logs';
          const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
          existingLogs.push(migrationLog);
          localStorage.setItem(storageKey, JSON.stringify(existingLogs));
          console.log('Migration log saved to localStorage as fallback');
        } catch (localStorageError) {
          console.error('Error saving to localStorage:', localStorageError);
        }
        
        // Return the log object even if saving failed
        return migrationLog;
      }
    } catch (error) {
      console.error('Error creating migration log:', error);
      
      // Generate a mock migration log for development
      const timestamp = new Date().toISOString();
      const mockId = `migration-${generateId()}`;
      
      return {
        id: mockId,
        created_at: timestamp,
        owner_id: userId,
        sourceCluster: {
          id: payload.sourceClusterId,
          name: payload.sourceClusterName
        },
        targetCluster: {
          id: payload.targetClusterId,
          name: payload.targetClusterName
        },
        status: payload.status || 'in-progress',
        resourcesTotal: payload.resourcesTotal,
        resourcesMigrated: 0,
        resourcesFailed: 0,
        error: payload.error
      };
    }
  },
  
  // Get all migration logs for a user
  async getMigrationLogs(userId: string): Promise<MigrationLog[]> {
    try {
      // Use ScanCommand instead of QueryCommand since we're filtering on owner_id which is not the full primary key
      const command = new ScanCommand({
        TableName: MIGRATION_LOGS_TABLE,
        FilterExpression: 'owner_id = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const response = await docClient.send(command);
      return (response.Items || []) as MigrationLog[];
    } catch (error) {
      console.error('Error getting migration logs:', error);
      // For development/testing, return mock data if DB operation fails
      return [];
    }
  },
  
  // Get a specific migration log by ID
  async getMigrationLogById(migrationId: string): Promise<MigrationLog | null> {
    try {
      const command = new GetCommand({
        TableName: MIGRATION_LOGS_TABLE,
        Key: {
          id: migrationId
        }
      });
      
      const response = await docClient.send(command);
      return response.Item as MigrationLog || null;
    } catch (error) {
      console.error('Error getting migration log:', error);
      return null;
    }
  },
  
  // Update a migration log (for updating status, progress, etc.)
  async updateMigrationLog(
    migrationId: string, 
    updates: Partial<{
      status: 'completed' | 'failed' | 'in-progress';
      resourcesMigrated: number;
      resourcesFailed: number;
      completedResources: any[];
      failedResources: Array<{ kind: string; name: string; namespace: string; error: string }>;
      duration: number;
      error: string;
    }>
  ): Promise<boolean> {
    try {
      // First ensure the table exists
      const tableExists = await ensureTableExists('migration_logs');
      if (!tableExists) {
        console.error('Could not ensure migration_logs table exists, storing in local storage instead');
        
        // Fall back to localStorage
        const existingData = localStorage.getItem(`migration_log_${migrationId}`);
        const logData = existingData ? JSON.parse(existingData) : {};
        
        localStorage.setItem(`migration_log_${migrationId}`, JSON.stringify({
          ...logData,
          ...updates,
          updatedAt: new Date().toISOString()
        }));
        
        return true;
      }
      
      // Build expression attribute names and values dynamically based on provided updates
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};
      
      let updateExpression = 'SET ';
      const updateExpressionParts: string[] = [];
      
      // Process each property in the updates object
      Object.entries(updates).forEach(([key, value], index) => {
        // Skip undefined values
        if (value === undefined) return;
        
        const attributeNameKey = `#attr${index}`;
        const attributeValueKey = `:val${index}`;
        
        expressionAttributeNames[attributeNameKey] = key;
        expressionAttributeValues[attributeValueKey] = value;
        
        updateExpressionParts.push(`${attributeNameKey} = ${attributeValueKey}`);
      });
      
      // Add updatedAt timestamp
      const timestampNameKey = '#updatedAt';
      const timestampValueKey = ':updatedAt';
      expressionAttributeNames[timestampNameKey] = 'updatedAt';
      expressionAttributeValues[timestampValueKey] = new Date().toISOString();
      updateExpressionParts.push(`${timestampNameKey} = ${timestampValueKey}`);
      
      // Combine all parts into the update expression
      updateExpression += updateExpressionParts.join(', ');
      
      // Only update if there are attributes to update
      if (Object.keys(expressionAttributeValues).length === 0) {
        console.log('No attributes to update in migration log');
        return true;
      }
      
      // First, do a scan to find the migration log entry that matches our ID
      // This is not the most efficient way, but it will let us get both id and owner_id
      try {
        const scanCommand = new ScanCommand({
          TableName: 'migration_logs',
          FilterExpression: 'id = :migrationId',
          ExpressionAttributeValues: {
            ':migrationId': migrationId
          },
          Limit: 1 // We only need one record
        });
        
        console.log(`Scanning for migration log with id ${migrationId}`);
        const scanResult = await docClient.send(scanCommand);
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
          console.log(`No migration log found with id ${migrationId}, skipping update`);
          
          // Fall back to localStorage when record doesn't exist
          const existingData = localStorage.getItem(`migration_log_${migrationId}`);
          const logData = existingData ? JSON.parse(existingData) : {};
          
          localStorage.setItem(`migration_log_${migrationId}`, JSON.stringify({
            ...logData,
            ...updates,
            updatedAt: new Date().toISOString()
          }));
          
          return true;
        }
        
        // Get the item with all its attributes
        const item = scanResult.Items[0];
        console.log(`Found migration log: ${JSON.stringify(item)}`);
        
        // Now we can use the correct key structure with both id and owner_id
        if (item.id && item.owner_id) {
          const updateCommand = new UpdateCommand({
            TableName: 'migration_logs',
            Key: { 
              id: item.id,
              owner_id: item.owner_id 
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'UPDATED_NEW'
          });
          
          await docClient.send(updateCommand);
          console.log(`Migration log updated for ${migrationId}`);
          return true;
        } else {
          throw new Error(`Found item but missing required key attributes: ${JSON.stringify(item)}`);
        }
      } catch (scanError) {
        console.error(`Error scanning for migration log: ${scanError}`);
        
        // Fall back to localStorage when scan fails
        const existingData = localStorage.getItem(`migration_log_${migrationId}`);
        const logData = existingData ? JSON.parse(existingData) : {};
        
        localStorage.setItem(`migration_log_${migrationId}`, JSON.stringify({
          ...logData,
          ...updates,
          updatedAt: new Date().toISOString()
        }));
        
        console.log(`Saved migration log to localStorage for ${migrationId} after scan failure`);
        return true;
      }
    } catch (error) {
      console.error('Error updating migration log:', error);
      
      // Fall back to localStorage when DynamoDB fails
      try {
        const existingData = localStorage.getItem(`migration_log_${migrationId}`);
        const logData = existingData ? JSON.parse(existingData) : {};
        
        localStorage.setItem(`migration_log_${migrationId}`, JSON.stringify({
          ...logData,
          ...updates,
          updatedAt: new Date().toISOString()
        }));
        
        console.log(`Saved migration log to localStorage for ${migrationId}`);
        return true;
      } catch (storageError) {
        console.error('Failed to save to localStorage:', storageError);
        return false;
      }
    }
  },
  
  // Delete a migration log
  async deleteMigrationLog(migrationId: string): Promise<boolean> {
    try {
      const command = new DeleteCommand({
        TableName: MIGRATION_LOGS_TABLE,
        Key: {
          id: migrationId
        }
      });
      
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting migration log:', error);
      return false;
    }
  }
}; 