'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/features/leads/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isAttendant: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
  isManager: false,
  isSupervisor: false,
  isAttendant: false,
});

export const useAuth = () => useContext(AuthContext);

export const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5052`;
  }
  return 'http://localhost:5052';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      setToken(storedToken);
      fetchMe(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchMe = async (authToken: string) => {
    const apiUrl = getApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        logout();
      }
    } catch (e) {
      console.error(e);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    const apiUrl = getApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, email: identifier, password }),
      });

      if (!res.ok) {
        let errDetail = 'Falha ao autenticar';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errDetail;
        } catch (_) {
          errDetail = `Erro HTTP ${res.status}: Servidor não retornou resposta JSON válida.`;
        }
        throw new Error(errDetail);
      }

      const data = await res.json();
      const newToken = data.access_token;
      const userData = data.user;

      localStorage.setItem('access_token', newToken);
      setToken(newToken);
      setUser(userData);
      setIsLoading(false);
      router.push('/leads');
    } catch (error: any) {
      setIsLoading(false);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Não foi possível conectar ao servidor backend (${apiUrl}). Verifique se o container crm_backend está em execução na porta 5052.`);
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
    setIsLoading(false);
    router.push('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const isSupervisor = user?.role === 'supervisor' || isManager;
  const isAttendant = user?.role === 'attendant';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAdmin,
        isManager,
        isSupervisor,
        isAttendant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
