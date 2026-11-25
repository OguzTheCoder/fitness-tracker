import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  authService,
  type LoginPayload,
  type RegisterPayload,
  type User,
} from '../services/authService';

export const TOKEN_STORAGE_KEY = 'ft_auth_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    authService
      .me(token)
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const applySession = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authService.login(payload);
      return applySession(res.token, res.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await authService.register(payload);
      return applySession(res.token, res.user);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir.');
  }
  return ctx;
}
