import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  Instagram,
  CheckSquare,
  ActivitySquare,
  Wallet,
  History,
  Download,
  LogOut,
  Menu,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const adminNav = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Review", href: "/admin/review", icon: CheckSquare },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Accounts", href: "/admin/accounts", icon: Instagram },
  { name: "Ödeme Takip", href: "/admin/odeme-takip", icon: CreditCard },
  { name: "Monitoring", href: "/admin/monitoring", icon: ActivitySquare },
  { name: "Wallets", href: "/admin/wallets", icon: Wallet },
  { name: "Audit Logs", href: "/admin/audit", icon: History },
  { name: "Export", href: "/admin/export", icon: Download },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user || user.role !== "admin") {
    return null;
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 font-semibold">
        <Instagram className="mr-2 h-5 w-5 text-sidebar-primary" />
        <span>Reels Control Panel</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {adminNav.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col text-sm">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-sidebar-foreground/70">Admin</span>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-r border-sidebar-border md:block">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="font-semibold flex items-center">
            <Instagram className="mr-2 h-5 w-5 text-primary" />
            Reels Panel
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
