import React, { createContext, useContext, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
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
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      queryKey: ["get-me"],
      retry: false,
    },
  });

  const logoutMutation = useLogout();

  const login = (loggedInUser: User) => {
    queryClient.setQueryData(getGetMeQueryKey(), loggedInUser);

    if (loggedInUser.role === "admin") {
      setLocation("/admin/dashboard");
    } else {
      setLocation("/dashboard");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync(undefined as unknown as void);
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      queryClient.clear();
      setLocation("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: isUserLoading, login, logout: handleLogout }}>
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
