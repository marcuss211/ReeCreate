import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TicketCheck, Circle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık", in_progress: "İnceleniyor", waiting_user: "Cevap Bekleniyor", resolved: "Çözüldü", closed: "Kapatıldı",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800", in_progress: "bg-yellow-100 text-yellow-800",
  waiting_user: "bg-purple-100 text-purple-800", resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-600",
};
const PRIORITY_LABELS: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", urgent: "Acil" };
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700", urgent: "bg-red-100 text-red-700",
};
const CATEGORY_LABELS: Record<string, string> = {
  technical: "Teknik Sorun", login: "Giriş Problemi", reels: "Reels / Gönderim",
  account: "Hesap Atama", payment: "Ödeme", panel: "Panel Hatası", other: "Diğer",
};

interface Ticket {
  id: number;
  ticketNo: string;
  userId: number;
  userName: string | null;
  userUsername: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assignedAdminId: number | null;
  isReadByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function AdminSupport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (search.trim()) params.set("search", search.trim());
    const q = params.toString();
    return `/api/tickets${q ? `?${q}` : ""}`;
  };

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-tickets", statusFilter, priorityFilter, categoryFilter, search],
    queryFn: () => customFetch(buildQuery()),
    refetchInterval: 30_000,
  });

  const unread = (tickets ?? []).filter(t => !t.isReadByAdmin).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Destek Talepleri
          {unread > 0 && <Badge className="bg-red-100 text-red-700">{unread} yeni</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">Tüm kullanıcı destek taleplerini yönetin</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ticket no, başlık veya kullanıcı ara..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Öncelik" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Öncelikler</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kategoriler</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Ticket table */}
      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ticket</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kategori</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Öncelik</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mesaj</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Güncelleme</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    </tr>
                  ))
                ) : (tickets ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-muted-foreground">
                      <TicketCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Ticket bulunamadı
                    </td>
                  </tr>
                ) : (
                  (tickets ?? []).map(ticket => (
                    <tr key={ticket.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${!ticket.isReadByAdmin ? "bg-blue-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!ticket.isReadByAdmin && <Circle className="h-2 w-2 fill-blue-500 text-blue-500 shrink-0" />}
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{ticket.ticketNo}</p>
                            <p className="font-medium text-sm max-w-48 truncate">{ticket.subject}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{ticket.userName ?? "—"}</p>
                        {ticket.userUsername && <p className="text-xs text-muted-foreground">@{ticket.userUsername}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[ticket.status] ?? ""}`}>
                          {STATUS_LABELS[ticket.status] ?? ticket.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{ticket.messageCount}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(ticket.updatedAt), "d MMM, HH:mm", { locale: tr })}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/support/${ticket.id}`}>
                          <button className="p-1 rounded hover:bg-muted transition-colors">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
