import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { AdminLayout } from "@/components/layout/admin-layout";
import { UserLayout } from "@/components/layout/user-layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminAccounts from "@/pages/admin/accounts";
import AdminReview from "@/pages/admin/review";
import AdminMonitoring from "@/pages/admin/monitoring";
import AdminWallets from "@/pages/admin/wallets";
import AdminAudit from "@/pages/admin/audit";
import AdminExport from "@/pages/admin/export";
import AdminOdemeTakip from "@/pages/admin/odeme-takip";
import AdminRaporlar from "@/pages/admin/raporlar";
import TwoFactorSetup from "@/pages/admin/two-factor-setup";
import TwoFactorVerify from "@/pages/admin/two-factor-verify";
import UserDashboard from "@/pages/user/dashboard";
import UserEntry from "@/pages/user/entry";
import UserHistory from "@/pages/user/history";
import UserCekim from "@/pages/user/cekim";
import { Redirect } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin/2fa-setup" component={TwoFactorSetup} />
      <Route path="/admin/2fa-verify" component={TwoFactorVerify} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />

      <Route path="/admin" component={() => <Redirect to="/admin/dashboard" />} />
      <Route path="/admin/dashboard">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminDashboard /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/review">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminReview /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminUsers /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/accounts">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminAccounts /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/monitoring">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminMonitoring /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/wallets">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminWallets /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/audit">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminAudit /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/export">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminExport /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/odeme-takip">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminOdemeTakip /></AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/raporlar">
        <ProtectedRoute requireAdmin>
          <AdminLayout><AdminRaporlar /></AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <UserLayout><UserDashboard /></UserLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/entry">
        <ProtectedRoute>
          <UserLayout><UserEntry /></UserLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute>
          <UserLayout><UserHistory /></UserLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cekim">
        <ProtectedRoute>
          <UserLayout><UserCekim /></UserLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
