import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { setAccessToken, setOnUnauthenticated } from '../api/client';
import { authApi } from '../api/auth.api';
import type { User } from '@cyberguard/shared';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  // Register the unauthenticated callback so the API client can clear state
  useEffect(() => {
    setOnUnauthenticated(clearAuth);
  }, [clearAuth]);

  // On mount, try to restore session via refresh cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const data = await authApi.refresh();
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        // No valid refresh cookie — user needs to log in
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.register({ name, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
  }, [clearAuth]);

  const createOrganization = useCallback(async (name: string) => {
    await authApi.createOrganization({ name, country: 'NG', industry: 'technology', timezone: 'Africa/Lagos' });
    // Refresh user to get updated organizationId and role
    const refreshed = await authApi.refresh();
    setAccessToken(refreshed.accessToken);
    const updated = refreshed.user;
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    const refreshed = await authApi.refresh();
    setAccessToken(refreshed.accessToken);
    const updated = refreshed.user;
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      createOrganization,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
