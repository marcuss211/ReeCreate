import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Wallet,
  LogOut,
  Menu,
  Instagram
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const userNav = [
  { name: "Ana Sayfa", href: "/dashboard", icon: LayoutDashboard },
  { name: "Günlük Giriş", href: "/entry", icon: PlusCircle },
  { name: "Geçmiş", href: "/history", icon: History },
  { name: "Cüzdan (Çekim)", href: "/cekim", icon: Wallet },
];

export function UserLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user || user.role !== "user") {
    return null;
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 font-semibold">
        <Instagram className="mr-2 h-5 w-5 text-sidebar-primary" />
        <span>Reels Portalı</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {userNav.map((item) => {
            const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
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
            <span className="text-xs text-sidebar-foreground/70">Sicil No: {user.personnelNo || "—"}</span>
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
                <span className="sr-only">Menüyü aç</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="font-semibold flex items-center">
            <Instagram className="mr-2 h-5 w-5 text-primary" />
            Reels Portalı
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
