import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearCachedSessionMeta,
  getCachedSessionMeta,
  saveCachedSessionMeta,
} from '../offline/offlineDb';
import {
  isNetworkOfflineError,
  setActiveOfflineUserId,
  subscribeOfflineEvents,
} from '../offline/offlineHelpers';
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
  isOfflineSession: boolean;
  authNotice: string | null;
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
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const persistActiveUser = useCallback(
    (nextUser: User, mode: AccessMode, configured: boolean) => {
      setActiveOfflineUserId(nextUser.id);
      setIsOfflineSession(false);
      setAuthNotice(null);
      void saveCachedSessionMeta({
        user: nextUser,
        accessMode: mode,
        isConfigured: configured,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    authService
      .getAccessStatus()
      .then((status) => {
        if (cancelled) return;
        setAccessMode(status.mode);
        setIsConfigured(status.isConfigured);
        if (status.isAuthenticated && status.user) {
          setUser(status.user);
          persistActiveUser(status.user, status.mode, status.isConfigured);
        } else {
          setUser(null);
          setActiveOfflineUserId(null);
          setIsOfflineSession(false);
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (isNetworkOfflineError(err)) {
          const cached = await getCachedSessionMeta().catch(() => null);
          if (!cancelled && cached?.user) {
            setAccessMode(cached.accessMode);
            setIsConfigured(cached.isConfigured);
            setUser(cached.user);
            setActiveOfflineUserId(cached.user.id);
            setIsOfflineSession(true);
            return;
          }
        }
        if (!cancelled) {
          setUser(null);
          setActiveOfflineUserId(null);
          setIsOfflineSession(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [persistActiveUser]);

  // Option 2-A: if server returns 401 during online sync, prompt re-auth while keeping offline queue intact.
  useEffect(() => {
    return subscribeOfflineEvents((event) => {
      if (event === 'auth-required') {
        setUser(null);
        setActiveOfflineUserId(null);
        setIsOfflineSession(false);
        setAuthNotice(
          'Oturum süreniz doldu. Çevrimdışı bekleyen kayıtlarınız korundu; tekrar giriş yaptığınızda otomatik eşitlenecek.',
        );
      }
    });
  }, []);

  const setupAccess = useCallback(
    async (payload: SetupAccessPayload) => {
      const res = await authService.setupAccess(payload);
      setAccessMode(res.mode);
      setIsConfigured(true);
      setUser(res.user);
      persistActiveUser(res.user, res.mode, true);
      return res.user;
    },
    [persistActiveUser],
  );

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const res = await authService.unlockWithPin(pin);
      setAccessMode(res.mode);
      setIsConfigured(true);
      setUser(res.user);
      persistActiveUser(res.user, res.mode, true);
      return res.user;
    },
    [persistActiveUser],
  );

  const resumeLocalSession = useCallback(
    async (/* no args */) => {
      const res = await authService.resumeLocalSession();
      setAccessMode(res.mode);
      setIsConfigured(true);
      setUser(res.user);
      persistActiveUser(res.user, res.mode, true);
      return res.user;
    },
    [persistActiveUser],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authService.login(payload);
      setUser(res.user);
      persistActiveUser(res.user, accessMode, isConfigured);
      return res.user;
    },
    [accessMode, isConfigured, persistActiveUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await authService.register(payload);
      setUser(res.user);
      persistActiveUser(res.user, accessMode, isConfigured);
      return res.user;
    },
    [accessMode, isConfigured, persistActiveUser],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Cookie clearing failure should still clear local React session state.
    } finally {
      setUser(null);
      setActiveOfflineUserId(null);
      setIsOfflineSession(false);
      setAuthNotice(null);
      void clearCachedSessionMeta();
    }
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    setUser(null);
    setActiveOfflineUserId(null);
    setIsOfflineSession(false);
    setAuthNotice(null);
    void clearCachedSessionMeta();
  }, []);

  const syncUserName = useCallback(
    (name: string) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, name };
        void saveCachedSessionMeta({
          user: next,
          accessMode,
          isConfigured,
          updatedAt: new Date().toISOString(),
        });
        return next;
      });
    },
    [accessMode, isConfigured],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessMode,
        isConfigured,
        isLoading,
        isAuthenticated: Boolean(user),
        isOfflineSession,
        authNotice,
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
