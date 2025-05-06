import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

/**
 * Utility function to check if the Cognito User Pool configuration is working
 */
export async function checkCognitoUserPool() {
  try {
    console.log('Checking Cognito User Pool configuration...');
    
    // Get configuration from environment variables
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const region = import.meta.env.VITE_DYNAMODB_REGION || import.meta.env.VITE_AWS_REGION || 'us-east-1';
    const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
    const isProduction = import.meta.env.PROD === true;
    
    // Log configuration
    console.log('Cognito Configuration:');
    console.log('User Pool ID:', userPoolId);
    console.log('Region:', region);
    console.log('Environment:', isProduction ? 'Production' : 'Development');
    
    // Check if required configuration is present
    if (!userPoolId) {
      throw new Error('Missing User Pool ID. Please set VITE_COGNITO_USER_POOL_ID in your .env file');
    }
    
    // Create Cognito client with appropriate credentials based on environment
    let cognitoClient;
    
    if (isProduction) {
      // In production, use the EC2 instance role (no explicit credentials)
      console.log('Using IAM Role from EC2 instance for Cognito authentication');
      cognitoClient = new CognitoIdentityProviderClient({ region });
    } else {
      // In development, use explicit credentials
      console.log('Using explicit AWS credentials for Cognito authentication');
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('Missing AWS credentials. Please set VITE_AWS_ACCESS_KEY_ID and VITE_AWS_SECRET_ACCESS_KEY in your .env file');
      }
      
      cognitoClient = new CognitoIdentityProviderClient({ 
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
    
    // Try to list users (limited to 1 to avoid fetching too much data)
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 1
    });
    
    console.log('Attempting to list users from Cognito User Pool...');
    const response = await cognitoClient.send(command);
    
    // Check if the response contains user data
    if (response.Users) {
      console.log(`Connection successful! Found ${response.Users.length} users.`);
      return {
        success: true,
        message: `Successfully connected to Cognito User Pool`,
        data: {
          userCount: response.Users.length
        }
      };
    } else {
      return {
        success: true,
        message: 'Connected to Cognito User Pool, but no users found',
        data: { userCount: 0 }
      };
    }
  } catch (error) {
    console.error('Cognito User Pool check failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error
    };
  }
}

// Export function to manually run the check
export const cognitoCheck = {
  run: checkCognitoUserPool
}; 