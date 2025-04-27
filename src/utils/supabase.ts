// This file exists to support older imports that haven't been updated yet.
// It redirects all Supabase functionality to our new DynamoDB implementation.

import {
  authService,
  clusterService,
  checkpointService,
  Cluster,
  Checkpoint,
  CheckpointStatus,
  CreateClusterPayload,
  CreateCheckpointPayload,
  UserCredentials,
  UserRegistration
} from './dynamodb';

// Create a dummy supabase client to prevent errors
export const supabase = {
  auth: {
    onAuthStateChange: () => {
      return {
          data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }
  }
};

// Re-export non-type exports
export {
  authService,
  clusterService,
  checkpointService
};

// Re-export type exports
export type {
  Cluster,
  Checkpoint,
  CheckpointStatus,
  CreateClusterPayload,
  CreateCheckpointPayload,
  UserCredentials,
  UserRegistration
};
