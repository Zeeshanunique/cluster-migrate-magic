import YAML from 'yaml';
import { Credentials } from '@aws-sdk/types';
import { Base64 } from 'js-base64';

/**
 * Extracts AWS credentials from environment variables or kubeconfig
 * @param kubeconfig The kubeconfig file content as a string
 * @returns AWS credentials or undefined if not found
 */
export async function getAwsCredentialsFromKubeconfig(kubeconfig: string): Promise<Credentials | undefined> {
  try {
    // First, try to get credentials from environment variables
    const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
    const sessionToken = import.meta.env.VITE_AWS_SESSION_TOKEN;

    // Check if the essential credentials are available
    if (accessKeyId && secretAccessKey) {
      console.log('Using AWS credentials from environment variables');
      return {
        accessKeyId,
        secretAccessKey,
        sessionToken: sessionToken || undefined
      };
    } else {
      console.warn('AWS credentials not found in environment variables');
    }

    // If environment variables aren't set, try to extract from kubeconfig
    console.log('Attempting to extract credentials from kubeconfig');
    
    // Extract any token that might be present in the kubeconfig
    const config = YAML.parse(kubeconfig);
    
    // Get current context and user
    const currentContext = config.currentContext || config['current-context'];
    if (!currentContext) {
      console.error('No current context found in kubeconfig');
      return undefined;
    }
    
    const context = config.contexts?.find((ctx: any) => ctx.name === currentContext);
    if (!context) {
      console.error(`Context "${currentContext}" not found in kubeconfig`);
      return undefined;
    }
    
    const userName = context.context?.user;
    if (!userName) {
      console.error('No user specified in current context');
      return undefined;
    }
    
    const user = config.users?.find((u: any) => u.name === userName);
    if (!user) {
      console.error(`User "${userName}" not found in kubeconfig`);
      return undefined;
    }
    
    // Check if a token is directly available in the kubeconfig
    if (user.user?.token) {
      console.log('Found token in kubeconfig, but AWS SDK requires access key/secret');
      // Note: This won't work for AWS SDK which requires access key and secret
    }
    
    // Unfortunately, we can't use the exec auth in browser
    if (user.user?.exec) {
      console.warn('Exec-based authentication found but cannot be used in browser environment');
      console.warn('Please provide AWS credentials via environment variables');
    }

    // Last resort - check if hardcoded credentials were added to kubeconfig (not recommended)
    if (user.user?.['aws-access-key-id'] && user.user?.['aws-secret-access-key']) {
      return {
        accessKeyId: user.user['aws-access-key-id'],
        secretAccessKey: user.user['aws-secret-access-key'],
        sessionToken: user.user['aws-session-token']
      };
    }
    
    console.error('No valid AWS credentials found in environment variables or kubeconfig');
    return undefined;
  } catch (error) {
    console.error('Error extracting AWS credentials:', error);
    return undefined;
  }
}

/**
 * Gets a Kubernetes API token from various sources
 * @param kubeconfig The kubeconfig file content as a string
 * @returns An authentication token or undefined if not found
 */
export async function getK8sAuthToken(kubeconfig: string): Promise<string | undefined> {
  try {
    // First check if we have a token in environment variables
    const envToken = import.meta.env.VITE_K8S_AUTH_TOKEN;
    if (envToken) {
      console.log('Using Kubernetes token from environment variables');
      return envToken;
    }

    const config = YAML.parse(kubeconfig);
    
    // Get current context
    const currentContext = config.currentContext || config['current-context'];
    if (!currentContext) {
      console.error('No current context found in kubeconfig');
      return undefined;
    }
    
    // Find context object
    const context = config.contexts?.find((ctx: any) => ctx.name === currentContext);
    if (!context) {
      console.error(`Context "${currentContext}" not found in kubeconfig`);
      return undefined;
    }
    
    // Get user name from context
    const userName = context.context?.user;
    if (!userName) {
      console.error('No user specified in current context');
      return undefined;
    }
    
    // Find user object
    const user = config.users?.find((u: any) => u.name === userName);
    if (!user) {
      console.error(`User "${userName}" not found in kubeconfig`);
      return undefined;
    }
    
    // Check for static token authentication (simplest case)
    if (user.user?.token) {
      return user.user.token;
    }
    
    // If we have client certificate authentication, we would need to handle this differently
    // This requires a backend service to handle certificate-based authentication
    if (user.user?.['client-certificate-data'] && user.user?.['client-key-data']) {
      throw new Error('Client certificate authentication is not supported in the browser');
    }
    
    // If there's an exec command, we need to handle that
    if (user.user?.exec) {
      // Check if the token has already been populated (some tools do this)
      if (user.user.exec.token) {
        return user.user.exec.token;
      }
      throw new Error('Exec authentication requires a backend service component');
    }
    
    // No supported authentication method found
    throw new Error('No supported authentication method found in kubeconfig');
  } catch (error) {
    console.error('Error extracting auth token from kubeconfig:', error);
    throw error;
  }
}

export default {
  getAwsCredentialsFromKubeconfig,
  getK8sAuthToken,
};