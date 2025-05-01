import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, UserCredentials, UserRegistration } from '@/utils/dynamodb';

// Define user type to match what was provided by Supabase
type User = {
  id: string;
  email: string;
};

// Define session type to match what was provided by Supabase
type Session = {
  access_token: string;
  refresh_token: string;
};

// Define the auth context type
type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (credentials: UserCredentials) => Promise<{ user: User | null; session: Session | null }>;
  signUp: (credentials: UserRegistration) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
};

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  console.log('Current environment variables:');
  console.log('VITE_COGNITO_USER_POOL_ID:', import.meta.env.VITE_COGNITO_USER_POOL_ID);
  console.log('VITE_COGNITO_CLIENT_ID:', import.meta.env.VITE_COGNITO_CLIENT_ID);
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session from Cognito...');
        const session = await authService.getSession();
        setSession(session);
        if (session) {
          console.log('Session found, getting user details...');
          const user = await authService.getUser();
          console.log('User details retrieved:', user ? `ID: ${user.id}` : 'No user');
          setUser(user);
        } else {
          console.log('No active session found');
          setUser(null);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Setup event listener for auth state changes (simpler implementation than Supabase's)
    window.addEventListener('storage', (event) => {
      if (event.key === 'accessToken') {
        console.log('Storage event detected for auth token, refreshing session...');
        getInitialSession();
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('storage', () => {});
    };
  }, []);

  // Sign in function
  const signIn = async (credentials: UserCredentials) => {
    try {
      console.log('Signing in with Cognito...');
      const result = await authService.signIn(credentials);
      console.log('Sign in successful:', result.user ? `User ID: ${result.user.id}` : 'No user returned');
      
      // Update state with the user and session data
      if (result.user && result.session) {
        setUser(result.user);
        setSession(result.session);
      }
      
      return result;
    } catch (error) {
      console.error('Error signing in with Cognito:', error);
      return { user: null, session: null };
    }
  };

  // Sign up function
  const signUp = async (credentials: UserRegistration) => {
    try {
      console.log('Signing up with Cognito...');
      const result = await authService.signUp(credentials);
      console.log('Sign up successful:', result.user ? `User ID: ${result.user.id}` : 'No user returned');
      
      // Update state with the user and session data if available
      if (result.user && result.session) {
        setUser(result.user);
        setSession(result.session);
      }
      
      return result;
    } catch (error) {
      console.error('Error signing up with Cognito:', error);
      return { user: null, session: null };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log('Signing out from Cognito...');
      await authService.signOut();
      setUser(null);
      setSession(null);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error signing out from Cognito:', error);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    return await authService.resetPassword(email);
  };

  // Update password
  const updatePassword = async (password: string) => {
    return await authService.updatePassword(password);
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Auth hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 