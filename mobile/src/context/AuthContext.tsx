import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthUser } from "../types";
import { fetchMe } from "../api/auth";
import { clearToken, getToken, setToken as persistToken } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { user: me } = await fetchMe();
        setUser(me);
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (token: string, nextUser: AuthUser) => {
    await persistToken(token);
    setUser(nextUser);
  };

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  const value = useMemo(() => ({ user, isLoading, signIn, signOut }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
