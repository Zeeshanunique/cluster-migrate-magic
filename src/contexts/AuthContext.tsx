import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, authService, UserCredentials, UserRegistration } from '@/utils/supabase';

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the initial session
    const getInitialSession = async () => {
      try {
        const session = await authService.getSession();
        setSession(session);
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = async (credentials: UserCredentials) => {
    try {
      const { user, session } = await authService.signIn(credentials);
      return { user, session };
    } catch (error) {
      console.error('Error signing in:', error);
      return { user: null, session: null };
    }
  };

  // Sign up function
  const signUp = async (credentials: UserRegistration) => {
    try {
      const { user, session } = await authService.signUp(credentials);
      return { user, session };
    } catch (error) {
      console.error('Error signing up:', error);
      return { user: null, session: null };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
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