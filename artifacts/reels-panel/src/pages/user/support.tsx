import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, TicketCheck, ChevronRight, Circle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İnceleniyor",
  waiting_user: "Cevap Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  waiting_user: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const PRIORITY_LABELS: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", urgent: "Acil" };
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Teknik Sorun",
  login: "Giriş Problemi",
  reels: "Reels / Gönderim",
  account: "Hesap Atama",
  payment: "Ödeme",
  panel: "Panel Hatası",
  other: "Diğer",
};

const STATUS_FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İnceleniyor" },
  { value: "waiting_user", label: "Cevap Bekleniyor" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapatıldı" },
];

interface Ticket {
  id: number;
  ticketNo: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  isReadByUser: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function UserSupport() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "other", priority: "medium", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["user-tickets", statusFilter];
  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey,
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return customFetch(`/api/tickets${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => customFetch("/api/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Ticket oluşturuldu", description: "Destek talebiniz alındı." });
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-unread"] });
      setCreateOpen(false);
      setForm({ subject: "", category: "other", priority: "medium", message: "" });
      setErrors({});
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  function handleCreate() {
    const errs: Record<string, string> = {};
    if (!form.subject.trim()) errs.subject = "Başlık gerekli";
    if (!form.message.trim()) errs.message = "Açıklama gerekli";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Destek Talepleri</h1>
          <p className="text-sm text-muted-foreground">Yardım talep edin veya mevcut taleplerinizi takip edin</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Ticket
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-1">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === f.value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : (tickets ?? []).length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-14 text-center text-muted-foreground">
            <TicketCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {statusFilter === "all" ? "Henüz destek talebiniz yok" : "Bu durumda ticket bulunamadı"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(tickets ?? []).map(ticket => (
            <Link key={ticket.id} href={`/support/${ticket.id}`}>
              <Card className={`border-card-border hover:shadow-sm transition-shadow cursor-pointer ${!ticket.isReadByUser ? "border-l-4 border-l-blue-500" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!ticket.isReadByUser && <Circle className="h-2 w-2 fill-blue-500 text-blue-500 shrink-0" />}
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNo}</span>
                        <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                        </Badge>
                        <Badge className={`text-xs ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[ticket.status] ?? ticket.status}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{ticket.subject}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                        <span>·</span>
                        <span>{ticket.messageCount} mesaj</span>
                        <span>·</span>
                        <span>{format(new Date(ticket.updatedAt), "d MMM yyyy, HH:mm", { locale: tr })}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Destek Talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Başlık</Label>
              <Input
                placeholder="Sorununuzu kısaca özetleyin"
                value={form.subject}
                onChange={e => { setForm(p => ({ ...p, subject: e.target.value })); setErrors(p => ({ ...p, subject: "" })); }}
                className={errors.subject ? "border-red-400" : ""}
              />
              {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Öncelik</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              <Textarea
                placeholder="Sorununuzu detaylı açıklayın..."
                rows={5}
                value={form.message}
                onChange={e => { setForm(p => ({ ...p, message: e.target.value })); setErrors(p => ({ ...p, message: "" })); }}
                className={errors.message ? "border-red-400" : ""}
              />
              {errors.message && <p className="text-xs text-red-500">{errors.message}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Gönderiliyor..." : "Ticket Oluştur"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
