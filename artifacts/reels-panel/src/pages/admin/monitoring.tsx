import { useGetUserBehaviorSummary, useListDelayFlags } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BehaviorBadge } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, Flag, TrendingDown } from "lucide-react";

export default function AdminMonitoring() {
  const { data: summaries, isLoading } = useGetUserBehaviorSummary();
  const { data: bulkFlags } = useListDelayFlags({ isBulkEntryFlag: "true" });

  const needsAttention = (summaries ?? []).filter(s => s.behavior !== "normal");
  const bulkUsers = (summaries ?? []).filter(s => s.bulkEntryFlags > 0);
  const delayedUsers = (summaries ?? []).filter(s => s.maxDelayDays >= 2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gecikme & Toplu Giriş İzleme</h1>
        <p className="text-sm text-muted-foreground">Kullanıcı gönderim davranışlarını takip et</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dikkat Gerekiyor</p>
                <p className="text-3xl font-bold mt-1">{needsAttention.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplu Giriş Şüphesi</p>
                <p className="text-3xl font-bold mt-1">{bulkUsers.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Flag className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">2+ Gün Gecikme</p>
                <p className="text-3xl font-bold mt-1">{delayedUsers.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Kullanıcı Davranış Özeti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Personel No</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Davranış</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gecikme Bayrağı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Maks. Gecikme</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Toplu Giriş</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tekrarlayan Sorun</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    </tr>
                  ))
                ) : (summaries ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <TrendingDown className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Veri bulunamadı
                    </td>
                  </tr>
                ) : (
                  (summaries ?? [])
                    .sort((a, b) => {
                      const order = ["needs attention", "bulk entry suspected", "2+ days delayed", "often delayed", "normal"];
                      return order.indexOf(a.behavior) - order.indexOf(b.behavior);
                    })
                    .map(s => (
                      <tr key={s.userId} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{s.userName}</td>
                        <td className="px-4 py-3">
                          {s.userPersonnelNo ? <span className="font-mono text-xs bg-muted px-2 py-1 rounded">#{s.userPersonnelNo}</span> : "—"}
                        </td>
                        <td className="px-4 py-3"><BehaviorBadge behavior={s.behavior} /></td>
                        <td className="px-4 py-3 text-center">{s.totalDelayFlags}</td>
                        <td className="px-4 py-3 text-center">
                          {s.maxDelayDays > 0 ? (
                            <span className={`font-medium ${s.maxDelayDays >= 2 ? "text-orange-600" : "text-yellow-600"}`}>
                              {s.maxDelayDays}g
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.bulkEntryFlags > 0 ? <span className="text-red-600 font-medium">{s.bulkEntryFlags}</span> : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.repeatIssues > 0 ? <span className="text-amber-600 font-medium">{s.repeatIssues}</span> : "—"}
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
