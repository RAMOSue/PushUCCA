import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, setApiAuthToken } from "../services/api";
import { AUTH_TOKEN_KEY } from "../constants/storage";
import type { AuthUser, LoginResponse } from "../types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistToken = useCallback(async (value: string | null) => {
    if (value) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, value);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

      if (!storedToken) {
        setUser(null);
        setToken(null);
        setApiAuthToken(null);
        return;
      }

      setToken(storedToken);
      setApiAuthToken(storedToken);

      const response = await api.get<AuthUser>("/api/auth/profile");
      setUser(response.data);
    } catch {
      setUser(null);
      setToken(null);
      setApiAuthToken(null);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<LoginResponse>("/api/auth/login", {
      email,
      password,
    });

    const { token: nextToken, user: nextUser } = response.data;
    setUser(nextUser);
    setToken(nextToken);
    setApiAuthToken(nextToken);
    await persistToken(nextToken);

    return response.data;
  }, [persistToken]);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setApiAuthToken(null);
    await persistToken(null);

    try {
      await api.post("/api/auth/logout");
    } catch {
      // Keep local logout behavior even if the web cookie cleanup request fails.
    }
  }, [persistToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      logout,
      restoreSession,
    }),
    [isLoading, login, logout, restoreSession, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
