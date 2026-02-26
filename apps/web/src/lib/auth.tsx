'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from './api';
import type { MeResponse } from './types';

type AuthContextShape = {
  token: string | null;
  me: MeResponse | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

const TOKEN_KEY = 'tkturners_finance_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    if (!token) {
      setMe(null);
      return;
    }

    const result = await apiRequest<MeResponse>('/finance/me', { token });
    setMe(result);
  };

  useEffect(() => {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (!existing) {
      setLoading(false);
      return;
    }

    setToken(existing);
  }, []);

  useEffect(() => {
    let active = true;

    if (!token) {
      setLoading(false);
      return;
    }

    refreshMe()
      .catch(() => {
        if (!active) return;
        setToken(null);
        setMe(null);
        window.localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const login = async (identifier: string, password: string) => {
    const payload = await apiRequest<{ jwt: string }>('/auth/local', {
      method: 'POST',
      body: { identifier, password },
    });

    window.localStorage.setItem(TOKEN_KEY, payload.jwt);
    setToken(payload.jwt);
    const meData = await apiRequest<MeResponse>('/finance/me', { token: payload.jwt });
    setMe(meData);
  };

  const logout = () => {
    setToken(null);
    setMe(null);
    window.localStorage.removeItem(TOKEN_KEY);
  };

  const value = useMemo(
    () => ({ token, me, loading, login, refreshMe, logout }),
    [token, me, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
