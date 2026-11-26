import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  authService,
  type AccessMode,
  type LoginPayload,
  type RegisterPayload,
  type SetupAccessPayload,
  type User,
} from '../services/authService';

interface AuthContextValue {
  user: User | null;
  accessMode: AccessMode;
  isConfigured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  setupAccess: (payload: SetupAccessPayload) => Promise<User>;
  unlockWithPin: (pin: string) => Promise<User>;
  resumeLocalSession: () => Promise<User>;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  syncUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>('local');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    authService
      .getAccessStatus()
      .then((status) => {
        if (cancelled) return;
        setAccessMode(status.mode);
        setIsConfigured(status.isConfigured);
        setUser(status.isAuthenticated ? status.user : null);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setupAccess = useCallback(async (payload: SetupAccessPayload) => {
    const res = await authService.setupAccess(payload);
    setAccessMode(res.mode);
    setIsConfigured(true);
    setUser(res.user);
    return res.user;
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const res = await authService.unlockWithPin(pin);
    setAccessMode(res.mode);
    setIsConfigured(true);
    setUser(res.user);
    return res.user;
  }, []);

  const resumeLocalSession = useCallback(async () => {
    const res = await authService.resumeLocalSession();
    setAccessMode(res.mode);
    setIsConfigured(true);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await authService.login(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await authService.register(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Cookie clearing failure should still clear local React session state.
    } finally {
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    setUser(null);
  }, []);

  const syncUserName = useCallback((name: string) => {
    setUser((prev) => (prev ? { ...prev, name } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessMode,
        isConfigured,
        isLoading,
        isAuthenticated: Boolean(user),
        setupAccess,
        unlockWithPin,
        resumeLocalSession,
        login,
        register,
        logout,
        logoutAll,
        syncUserName,
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
