import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, useLogout, setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

type User = {
  id: number;
  name: string;
  username: string;
  role: string;
  status: string;
  personnelNo?: number | null;
  createdAt: string;
  updatedAt: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize token getter
setAuthTokenGetter(() => {
  return localStorage.getItem("auth_token");
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("auth_token"));

  const { data: user, isLoading: isUserLoading, error } = useGetMe({
    query: {
      queryKey: ["get-me"],
      enabled: !!token,
      retry: false,
    }
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (error) {
      // Token might be invalid
      handleLogout();
    }
  }, [error]);

  const login = (newToken: string, user: User) => {
    localStorage.setItem("auth_token", newToken);
    setTokenState(newToken);
    queryClient.setQueryData(getGetMeQueryKey(), user);
    
    if (user.role === "admin") {
      setLocation("/admin/dashboard");
    } else {
      setLocation("/dashboard");
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await logoutMutation.mutateAsync(undefined as unknown as void);
      }
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      localStorage.removeItem("auth_token");
      setTokenState(null);
      queryClient.clear();
      setLocation("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: !!token && isUserLoading, login, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
