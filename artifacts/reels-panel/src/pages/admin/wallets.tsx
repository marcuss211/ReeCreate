import { useListWalletLogs, useListWalletAddresses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletStatusBadge } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Shield } from "lucide-react";
import { format, subDays } from "date-fns";
import { useMemo } from "react";

export default function AdminWallets() {
  const { data: allLogs, isLoading: allLoading } = useListWalletLogs({});
  const { data: wallets, isLoading: walletsLoading } = useListWalletAddresses({});

  const recentLogs = useMemo(() => {
    const cutoff = subDays(new Date(), 1);
    return (allLogs ?? []).filter(log => new Date(log.changedAt) >= cutoff);
  }, [allLogs]);
  const logsLoading = allLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cüzdan İzleme</h1>
        <p className="text-sm text-muted-foreground">Güvenlik için USDT TRC20 adres değişikliklerini takip et</p>
      </div>

      <Card className="border-l-4 border-l-amber-400 border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            Son 24 Saatteki Değişiklikler ({logsLoading ? "..." : (recentLogs ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (recentLogs ?? []).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Son 24 saatte cüzdan değişikliği yok</div>
          ) : (
            <div className="divide-y divide-border">
              {(recentLogs ?? []).map(log => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">{log.userName ?? `Kullanıcı #${log.userId}`}</p>
                    {log.userPersonnelNo && <p className="text-xs text-muted-foreground">#{log.userPersonnelNo}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-muted-foreground truncate max-w-28">{log.oldWalletAddress ? `${log.oldWalletAddress.slice(0, 8)}...` : "yeni"}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-foreground truncate max-w-28">{log.newWalletAddress.slice(0, 8)}...</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(log.changedAt), "HH:mm:ss")}</p>
                  {log.note && <p className="text-xs text-muted-foreground italic w-full">{log.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Mevcut Cüzdan Adresleri</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ağ</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cüzdan Adresi</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Güncellendi</th>
                </tr>
              </thead>
              <tbody>
                {walletsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    </tr>
                  ))
                ) : (wallets ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Kayıtlı cüzdan adresi yok</td></tr>
                ) : (
                  (wallets ?? []).map(w => (
                    <tr key={w.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{w.userName ?? `Kullanıcı #${w.userId}`}</span>
                        {w.userPersonnelNo && <span className="ml-1.5 text-xs text-muted-foreground">#{w.userPersonnelNo}</span>}
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{w.network}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{w.walletAddress}</td>
                      <td className="px-4 py-3"><WalletStatusBadge status={w.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(w.updatedAt), "dd MMM, HH:mm")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Tüm Değişiklik Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Önceki Adres</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Yeni Adres</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Değiştirilme Zamanı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Not</th>
                </tr>
              </thead>
              <tbody>
                {allLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    </tr>
                  ))
                ) : (allLogs ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Cüzdan değişikliği kaydı yok</td></tr>
                ) : (
                  [...(allLogs ?? [])].reverse().map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{log.userName ?? `Kullanıcı #${log.userId}`}</span>
                        {log.userPersonnelNo && <span className="ml-1.5 text-xs text-muted-foreground">#{log.userPersonnelNo}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.oldWalletAddress ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.newWalletAddress}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(log.changedAt), "dd MMM yyyy, HH:mm")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">{log.note ?? "—"}</td>
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
