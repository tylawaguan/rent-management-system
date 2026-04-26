import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageBranch: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rms_token'));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('rms_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token, logout]);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('rms_token', t);
    setToken(t);
    setUser(u);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isManager = user?.role === 'manager' || isAdmin;
  const canManageBranch = isAdmin;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isSuperAdmin, isAdmin, isManager, canManageBranch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
