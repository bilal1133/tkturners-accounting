import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import {
  AUTH_LOGOUT_EVENT,
  clearAuthSession,
  getStoredAuthSession,
  persistAuthSession,
  type AuthUser,
} from "../lib/authStorage";

interface User extends AuthUser {}

interface AuthContextType {
  user: User | null;
  jwt: string | null;
  login: (jwt: string, user: User, remember: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleForcedLogout = () => {
      if (!isMounted) return;
      setJwt(null);
      setUser(null);
      clearAuthSession();
      setIsLoading(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    }

    const restoreSession = async () => {
      const storedSession = getStoredAuthSession();
      if (!storedSession) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{
          id: number;
          username?: string | null;
          email: string;
        }>("/users/me");

        const restoredUser: User = {
          id: response.data.id,
          email: response.data.email,
          username:
            typeof response.data.username === "string" &&
            response.data.username.length > 0
              ? response.data.username
              : response.data.email,
        };

        if (!isMounted) return;
        setJwt(storedSession.jwt);
        setUser(restoredUser);
        persistAuthSession(
          storedSession.jwt,
          restoredUser,
          storedSession.persistence,
        );
      } catch (error) {
        console.error("Failed to restore auth session", error);
        if (!isMounted) return;
        setJwt(null);
        setUser(null);
        clearAuthSession();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
      }
    };
  }, []);

  const login = (token: string, userData: User, remember: boolean) => {
    setJwt(token);
    setUser(userData);
    persistAuthSession(token, userData, remember ? "local" : "session");
  };

  const logout = () => {
    setJwt(null);
    setUser(null);
    clearAuthSession();
  };

  return (
    <AuthContext.Provider value={{ user, jwt, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
