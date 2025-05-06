import { createTestUser } from './dynamodb';

/**
 * Utility function to create a test user in Cognito
 * This can be called from the browser console for testing purposes
 */
export async function createCognitoTestUser(email = 'test@example.com', password = 'Test@123', name = 'Test User') {
  console.log(`Creating test user: ${email}`);
  const result = await createTestUser(email, password, name);
  console.log('Result:', result);
  return result;
}

// Make it available in the global scope for easy access in the browser console
// @ts-ignore
window.createTestUser = createCognitoTestUser;

// Instructions for using in the browser console:
console.log(`
To create a test user, open your browser console and run:
createTestUser()  // Uses default credentials: test@example.com / Test@123
OR
createTestUser('your.email@example.com', 'YourPassword123', 'Your Name')
`); 