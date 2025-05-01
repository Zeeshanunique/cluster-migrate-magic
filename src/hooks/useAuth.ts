import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    // TODO: Implement actual auth check
    // For now, simulate an authenticated user
    setAuthState({
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      },
      isAuthenticated: true,
      isLoading: false
    });
  }, []);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading
  };
}
