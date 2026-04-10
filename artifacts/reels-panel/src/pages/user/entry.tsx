import { useState, useEffect, useRef } from "react";
import { useListInstagramAccounts, useCreateDailyReport, useGetDailyReport, useUpdateDailyReport, useCreateReportItem, useDeleteReportItem, getGetDailyReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { Plus, Trash2, CheckCircle, Save, AtSign, Film, AlertCircle, Link, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function RaporDurumBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Taslak</Badge>;
    case "submitted":   return <Badge className="bg-blue-100 text-blue-800">Onay Bekliyor</Badge>;
    case "approved":    return <Badge className="bg-green-100 text-green-800">Onaylandı</Badge>;
    case "rejected":    return <Badge className="bg-red-100 text-red-800">Reddedildi</Badge>;
    case "late":        return <Badge className="bg-yellow-100 text-yellow-800">Geç</Badge>;
    case "bulk_flagged":return <Badge className="bg-purple-100 text-purple-800">Toplu Giriş</Badge>;
    default:            return <Badge variant="outline">{status}</Badge>;
  }
}

function StatusMessage({ status }: { status: string }) {
  if (status === "draft") return null;

  if (status === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm font-medium text-green-700">Rapor onaylandı.</p>
      </div>
    );
  }

  if (status === "submitted" || status === "late") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Clock className="h-5 w-5 text-blue-600 shrink-0" />
        <p className="text-sm font-medium text-blue-700">Rapor gönderildi. Yönetici onayı bekleniyor.</p>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
        <p className="text-sm font-medium text-red-700">Rapor reddedildi. Yeni reels ekleyebilirsiniz.</p>
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-700">Rapor eksik işaretlendi. Lütfen eksik reelsleri ekleyiniz.</p>
      </div>
    );
  }

  return null;
}

const REELS_PATTERN = /instagram\.com\/reel(?:s)?\/([A-Za-z0-9_-]+)/;

function normalizeReelUrl(url: string): string | null {
  const m = url.match(REELS_PATTERN);
  if (!m) return null;
  return `https://www.instagram.com/reel/${m[1]}/`;
}

function formatEnteredAt(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd.MM.yyyy HH:mm");
  } catch {
    return dateStr;
  }
}

interface PendingItem {
  tempId: string;
  instagramAccountId: number;
  reelsUrl: string;
  saving: boolean;
  error?: string;
}

export default function UserEntry() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [reportId, setReportId] = useState<number | null>(null);
  const [newUrls, setNewUrls] = useState<Record<number, string>>({});
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pendingRef = useRef(pendingItems);
  pendingRef.current = pendingItems;

  const { data: accounts, isLoading: accountsLoading } = useListInstagramAccounts({});
  const activeAccounts = (accounts ?? []).filter(a => a.status === "active");

  const createReportMutation = useCreateDailyReport();
  const { data: reportDetail, isLoading: reportLoading } = useGetDailyReport(reportId ?? 0, {
    query: { queryKey: ["daily-report-detail", reportId], enabled: !!reportId }
  });
  const updateMutation = useUpdateDailyReport();
  const addItemMutation = useCreateReportItem();
  const deleteItemMutation = useDeleteReportItem();

  useEffect(() => {
    setPendingItems([]);
    createReportMutation.mutate({ data: { date } }, {
      onSuccess: (report) => setReportId(report.id),
    });
  }, [date]);

  function invalidate() {
    if (reportId) queryClient.invalidateQueries({ queryKey: getGetDailyReportQueryKey(reportId) });
  }

  function validateUrl(url: string, accountId: number): string | null {
    if (!url.trim()) return "URL gerekli";
    const normalized = normalizeReelUrl(url);
    if (!normalized) return "Geçerli bir Instagram Reels linki giriniz (instagram.com/reel/...)";

    const isDuplicateConfirmed = items.some(i => normalizeReelUrl(i.reelsUrl) === normalized);
    if (isDuplicateConfirmed) return "Bu reel zaten eklenmiş";

    const isDuplicatePending = pendingRef.current.some(
      p => !p.error && normalizeReelUrl(p.reelsUrl) === normalized
    );
    if (isDuplicatePending) return "Bu reel zaten ekleniyor...";

    return null;
  }

  function handleAddItem(accountId: number) {
    if (!reportId) return;
    const rawUrl = (newUrls[accountId] ?? "").trim();
    const error = validateUrl(rawUrl, accountId);
    if (error) {
      setUrlErrors(prev => ({ ...prev, [accountId]: error }));
      return;
    }

    const normalized = normalizeReelUrl(rawUrl)!;
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    setPendingItems(prev => [...prev, { tempId, instagramAccountId: accountId, reelsUrl: normalized, saving: true }]);
    setNewUrls(prev => ({ ...prev, [accountId]: "" }));
    setUrlErrors(prev => ({ ...prev, [accountId]: "" }));

    addItemMutation.mutate({
      data: {
        reportId,
        instagramAccountId: accountId,
        reelsUrl: normalized,
        contentDate: date,
      }
    }, {
      onSuccess: () => {
        setPendingItems(prev => prev.filter(p => p.tempId !== tempId));
        invalidate();
      },
      onError: (e: any) => {
        const msg = e?.message ?? "Eklenemedi";
        setPendingItems(prev => prev.map(p =>
          p.tempId === tempId ? { ...p, saving: false, error: msg } : p
        ));
        setNewUrls(prev => ({ ...prev, [accountId]: normalized }));
      }
    });
  }

  function handleDeletePending(tempId: string) {
    setPendingItems(prev => prev.filter(p => p.tempId !== tempId));
  }

  function handleDelete(itemId: number) {
    deleteItemMutation.mutate({ id: itemId }, {
      onSuccess: () => { invalidate(); toast({ title: "Reel silindi" }); },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  function handleSubmit() {
    if (!reportId) return;
    const stillSaving = pendingItems.some(p => p.saving);
    if (stillSaving) {
      toast({ title: "Lütfen bekleyin", description: "Reeller kaydediliyor...", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: reportId, data: { status: "submitted" } }, {
      onSuccess: () => {
        toast({ title: "Rapor gönderildi", description: "Günlük raporunuz incelemeye alındı." });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  const reportReady = !!reportId && !createReportMutation.isPending;
  const currentStatus = reportDetail?.status ?? "draft";
  const isDraft = currentStatus === "draft";
  const items = reportDetail?.items ?? [];
  const itemsByAccount = items.reduce<Record<number, typeof items>>((acc, item) => {
    if (!acc[item.instagramAccountId]) acc[item.instagramAccountId] = [];
    acc[item.instagramAccountId]!.push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Günlük Giriş</h1>
          <p className="text-sm text-muted-foreground">Günlük Instagram Reels linklerinizi girin</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-44" />
          {reportDetail && <RaporDurumBadge status={reportDetail.status} />}
        </div>
      </div>

      {accountsLoading || reportLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : activeAccounts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AtSign className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Henüz hesap atanmadı
          </CardContent>
        </Card>
      ) : (
        activeAccounts.map(account => {
          const accountItems = itemsByAccount[account.id] ?? [];
          const accountPending = pendingItems.filter(p => p.instagramAccountId === account.id);
          const totalCount = accountItems.length + accountPending.length;

          return (
            <Card key={account.id} className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  {account.instagramUsername}
                  <Badge variant="outline" className="ml-auto text-xs">
                    <Film className="h-3 w-3 mr-1" />
                    {totalCount} reel{totalCount !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Confirmed items */}
                {accountItems.map(item => (
                  <div key={item.id} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
                    <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <a href={item.reelsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                        {item.reelsUrl}
                      </a>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatEnteredAt(item.enteredAt ?? item.createdAt)}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteItemMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Optimistic (pending) items */}
                {accountPending.map(pending => (
                  <div key={pending.tempId}
                    className={`flex items-center gap-2 rounded-lg p-2.5 border ${pending.error ? "bg-red-50 border-red-200" : "bg-indigo-50/60 border-indigo-100"}`}>
                    {pending.saving
                      ? <Loader2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 animate-spin" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    }
                    <span className={`text-sm truncate flex-1 ${pending.error ? "text-red-600" : "text-indigo-600"}`}>
                      {pending.reelsUrl}
                    </span>
                    {pending.error && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeletePending(pending.tempId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Input form — always visible */}
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Input
                      placeholder={reportReady ? "https://www.instagram.com/reel/..." : "Yükleniyor..."}
                      value={newUrls[account.id] ?? ""}
                      disabled={!reportReady}
                      onChange={e => {
                        setNewUrls(prev => ({ ...prev, [account.id]: e.target.value }));
                        setUrlErrors(prev => ({ ...prev, [account.id]: "" }));
                      }}
                      onKeyDown={e => e.key === "Enter" && handleAddItem(account.id)}
                      className={urlErrors[account.id] ? "border-red-400" : ""}
                    />
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => handleAddItem(account.id)}
                      disabled={!reportReady || accountPending.some(p => p.saving)}>
                      {!reportReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Ekle
                    </Button>
                  </div>
                  {urlErrors[account.id] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {urlErrors[account.id]}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Submit button — only shown when status is draft */}
      {isDraft && activeAccounts.length > 0 && reportDetail && (
        <div className="flex gap-3 pt-2">
          <Button className="gap-2" onClick={handleSubmit} disabled={updateMutation.isPending || pendingItems.some(p => p.saving)}>
            <CheckCircle className="h-4 w-4" />
            Bugünü Gönder
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            <Save className="h-4 w-4" />
            Taslak olarak kaydedildi
          </Button>
        </div>
      )}

      {/* Dynamic status message */}
      {reportDetail && <StatusMessage status={currentStatus} />}
    </div>
  );
}
