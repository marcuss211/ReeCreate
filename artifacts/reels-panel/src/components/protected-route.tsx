import { ReactNode } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ 
  children, 
  requireAdmin = false 
}: { 
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requireAdmin && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  if (!requireAdmin && user.role === "admin" && !location.startsWith("/admin")) {
    return <Redirect to="/admin/dashboard" />;
  }

  return <>{children}</>;
}
