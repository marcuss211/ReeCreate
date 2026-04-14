import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, RefreshCw, User, ShieldCheck } from "lucide-react";
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

interface TicketDetail {
  id: number;
  ticketNo: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: Message[];
}

export default function UserSupportDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const [reply, setReply] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["ticket-detail", id],
    queryFn: () => customFetch(`/api/tickets/${id}`),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      customFetch(`/api/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-unread"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status: "open" }) }),
    onSuccess: () => {
      toast({ title: "Ticket yeniden açıldı" });
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  const isClosed = ticket?.status === "closed" || ticket?.status === "resolved";

  function handleSend() {
    if (!reply.trim()) return;
    sendMutation.mutate(reply.trim());
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Ticket bulunamadı.</p>
        <Button variant="link" onClick={() => navigate("/support")}>Geri dön</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/support")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground font-mono">{ticket.ticketNo}</p>
        </div>
      </div>

      {/* Ticket metadata */}
      <Card className="border-card-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={`text-xs ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
            <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </Badge>
            <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Oluşturuldu: {format(new Date(ticket.createdAt), "d MMM yyyy, HH:mm", { locale: tr })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Konuşma Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {ticket.messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Henüz mesaj yok</p>
          ) : (
            ticket.messages.map(msg => {
              const isAdmin = msg.senderRole === "admin";
              return (
                <div key={msg.id} className={`flex gap-2 ${isAdmin ? "" : "flex-row-reverse"}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[80%] space-y-1 ${isAdmin ? "" : "items-end"}`}>
                    <div className={`rounded-xl px-4 py-2.5 text-sm ${isAdmin ? "bg-muted rounded-tl-none" : "bg-primary text-primary-foreground rounded-tr-none"}`}>
                      {msg.message}
                    </div>
                    <p className={`text-xs text-muted-foreground ${isAdmin ? "" : "text-right"}`}>
                      {msg.senderName ?? (isAdmin ? "Destek" : "Siz")} · {format(new Date(msg.createdAt), "d MMM, HH:mm", { locale: tr })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Reply or Reopen */}
      {isClosed ? (
        <Card className="border-card-border">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {ticket.status === "resolved" ? "Bu ticket çözüldü olarak işaretlendi." : "Bu ticket kapatıldı."}
            </p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Yeniden Aç
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-card-border">
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="Cevabınızı yazın..."
              rows={3}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            />
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={sendMutation.isPending || !reply.trim()} className="gap-2">
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? "Gönderiliyor..." : "Gönder"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
