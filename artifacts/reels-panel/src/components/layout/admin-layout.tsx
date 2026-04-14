import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
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
  BarChart3,
  TicketCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function useAdminUnread() {
  const { data } = useQuery<{ unreadCount: number }>({
    queryKey: ["ticket-unread"],
    queryFn: () => customFetch("/api/tickets/unread-count"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return data?.unreadCount ?? 0;
}

const adminNavBase = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "İnceleme", href: "/admin/review", icon: CheckSquare },
  { name: "Kullanıcılar", href: "/admin/users", icon: Users },
  { name: "Hesaplar", href: "/admin/accounts", icon: Instagram },
  { name: "Ödeme Takip", href: "/admin/odeme-takip", icon: CreditCard },
  { name: "Raporlar", href: "/admin/raporlar", icon: BarChart3 },
  { name: "İzleme", href: "/admin/monitoring", icon: ActivitySquare },
  { name: "Cüzdanlar", href: "/admin/wallets", icon: Wallet },
  { name: "Destek Talepleri", href: "/admin/support", icon: TicketCheck, badge: true },
  { name: "Denetim Logu", href: "/admin/audit", icon: History },
  { name: "Dışa Aktar", href: "/admin/export", icon: Download },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const unreadCount = useAdminUnread();

  if (!user || user.role !== "admin") {
    return null;
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 font-semibold">
        <Instagram className="mr-2 h-5 w-5 text-sidebar-primary" />
        <span>Reels Kontrol Paneli</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {adminNavBase.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
          Çıkış Yap
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="hidden w-64 border-r border-sidebar-border md:block">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menüyü Aç</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="font-semibold flex items-center">
            <Instagram className="mr-2 h-5 w-5 text-primary" />
            Reels Paneli
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
