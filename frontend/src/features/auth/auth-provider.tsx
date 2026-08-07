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

import { getApiUrl } from '@/lib/config';
export { getApiUrl };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Limpar resíduos legados do localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    const storedToken = sessionStorage.getItem('access_token');
    if (storedToken) {
      setToken(storedToken);
      fetchMe(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id && token) {
        const apiUrl = getApiUrl();
        fetch(`${apiUrl}/api/v1/users/${user.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'offline' }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, token]);

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
        sessionStorage.setItem('user', JSON.stringify(userData));
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

      sessionStorage.setItem('access_token', newToken);
      sessionStorage.setItem('user', JSON.stringify(userData));
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

  const logout = async () => {
    if (user?.id && token) {
      try {
        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/api/v1/users/${user.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'offline' }),
        });
      } catch (e) {
        console.error('Erro ao definir status offline:', e);
      }
    }
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
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
