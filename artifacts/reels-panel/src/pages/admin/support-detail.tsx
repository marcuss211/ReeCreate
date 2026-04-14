import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, StickyNote, User, ShieldCheck, Lock } from "lucide-react";
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

interface Message {
  id: number;
  senderId: number;
  senderRole: string;
  senderName: string | null;
  message: string;
  createdAt: string;
}

interface Note {
  id: number;
  adminId: number;
  adminName: string | null;
  note: string;
  createdAt: string;
}

interface TicketDetail {
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
  assignedAdminName: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: Message[];
  notes: Note[];
}

interface Admin { id: number; name: string; }

export default function AdminSupportDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [replyStatus, setReplyStatus] = useState("none");
  const [note, setNote] = useState("");

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["admin-ticket-detail", id],
    queryFn: () => customFetch(`/api/tickets/${id}`),
    enabled: !!id,
  });

  const { data: admins } = useQuery<Admin[]>({
    queryKey: ["ticket-admins"],
    queryFn: () => customFetch("/api/ticket-admins"),
  });

  const sendMutation = useMutation({
    mutationFn: (data: { message: string; updateStatus?: string }) =>
      customFetch(`/api/tickets/${id}/messages`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      setReply("");
      setReplyStatus("none");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-unread"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      customFetch(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: (noteText: string) =>
      customFetch(`/api/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ note: noteText }) }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      toast({ title: "İç not eklendi" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  function handleSend() {
    if (!reply.trim()) return;
    sendMutation.mutate({
      message: reply.trim(),
      ...(replyStatus !== "none" ? { updateStatus: replyStatus } : {}),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Ticket bulunamadı.</p>
        <Button variant="link" onClick={() => navigate("/admin/support")}>Geri dön</Button>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/support")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground font-mono">{ticket.ticketNo} · {ticket.userName} (@{ticket.userUsername})</p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Badge className={`text-xs ${STATUS_COLORS[ticket.status] ?? ""}`}>{STATUS_LABELS[ticket.status] ?? ticket.status}</Badge>
          <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Left panel: admin controls */}
        <div className="space-y-4">
          <Card className="border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ticket Yönetimi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Durum</Label>
                <Select value={ticket.status} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Öncelik</Label>
                <Select value={ticket.priority} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Atanan Admin</Label>
                <Select
                  value={ticket.assignedAdminId?.toString() ?? "unassigned"}
                  onValueChange={v => updateMutation.mutate({ assignedAdminId: v === "unassigned" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                    {(admins ?? []).map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Kategori: <span className="text-foreground">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span></p>
                <p>Oluşturuldu: <span className="text-foreground">{format(new Date(ticket.createdAt), "d MMM yyyy, HH:mm", { locale: tr })}</span></p>
                {ticket.closedAt && <p>Kapatıldı: <span className="text-foreground">{format(new Date(ticket.closedAt), "d MMM yyyy, HH:mm", { locale: tr })}</span></p>}
              </div>
            </CardContent>
          </Card>

          {/* Internal notes */}
          <Card className="border-card-border border-l-4 border-l-amber-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                İç Notlar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Henüz iç not yok</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ticket.notes.map(n => (
                    <div key={n.id} className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 space-y-1">
                      <p className="text-xs">{n.note}</p>
                      <p className="text-xs text-muted-foreground">{n.adminName} · {format(new Date(n.createdAt), "d MMM, HH:mm", { locale: tr })}</p>
                    </div>
                  ))}
                </div>
              )}
              <Textarea
                placeholder="İç not ekle (yalnızca adminler görür)..."
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => noteMutation.mutate(note)} disabled={!note.trim() || noteMutation.isPending}>
                <StickyNote className="h-3.5 w-3.5" />
                {noteMutation.isPending ? "Ekleniyor..." : "Not Ekle"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right panel: chat */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Konuşma</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 max-h-[520px] overflow-y-auto">
              {ticket.messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Henüz mesaj yok</p>
              ) : (
                ticket.messages.map(msg => {
                  const isAdmin = msg.senderRole === "admin";
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isAdmin ? "flex-row-reverse" : ""}`}>
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className={`max-w-[80%] space-y-1 ${isAdmin ? "items-end" : ""}`}>
                        <div className={`rounded-xl px-4 py-2.5 text-sm ${isAdmin ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"}`}>
                          {msg.message}
                        </div>
                        <p className={`text-xs text-muted-foreground ${isAdmin ? "text-right" : ""}`}>
                          {msg.senderName ?? (isAdmin ? "Admin" : "Kullanıcı")} · {format(new Date(msg.createdAt), "d MMM, HH:mm", { locale: tr })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* Reply form */}
          {!isClosed ? (
            <Card className="border-card-border">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Kullanıcıya cevap yaz..."
                  rows={3}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-40">
                    <Select value={replyStatus} onValueChange={setReplyStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Durumu güncelle (isteğe bağlı)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Durumu değiştirme</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSend} disabled={sendMutation.isPending || !reply.trim()} className="gap-2">
                    <Send className="h-4 w-4" />
                    {sendMutation.isPending ? "Gönderiliyor..." : "Cevapla"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-card-border">
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">Ticket kapatıldı.</p>
                <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ status: "open" })}>
                  Yeniden Aç
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
