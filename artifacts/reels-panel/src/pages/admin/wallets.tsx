import { useListWalletLogs, useListWalletAddresses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletStatusBadge } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ArrowRight, Shield } from "lucide-react";
import { format, subDays } from "date-fns";

export default function AdminWallets() {
  const yesterday = subDays(new Date(), 1).toISOString();
  const { data: recentLogs, isLoading: logsLoading } = useListWalletLogs({ since: yesterday });
  const { data: allLogs, isLoading: allLoading } = useListWalletLogs({});
  const { data: wallets, isLoading: walletsLoading } = useListWalletAddresses({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wallet Monitoring</h1>
        <p className="text-sm text-muted-foreground">Track USDT TRC20 address changes for security</p>
      </div>

      <Card className="border-l-4 border-l-amber-400 border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            Changes in Last 24 Hours ({(recentLogs ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (recentLogs ?? []).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No wallet changes in the last 24 hours</div>
          ) : (
            <div className="divide-y divide-border">
              {(recentLogs ?? []).map(log => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">{log.userName ?? `User #${log.userId}`}</p>
                    {log.userPersonnelNo && <p className="text-xs text-muted-foreground">#{log.userPersonnelNo}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-muted-foreground truncate max-w-28">{log.oldWalletAddress ? `${log.oldWalletAddress.slice(0, 8)}...` : "new"}</span>
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
          <CardTitle className="text-base">Current Wallet Addresses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Network</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Wallet Address</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
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
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No wallet addresses registered</td></tr>
                ) : (
                  (wallets ?? []).map(w => (
                    <tr key={w.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{w.userName ?? `User #${w.userId}`}</span>
                        {w.userPersonnelNo && <span className="ml-1.5 text-xs text-muted-foreground">#{w.userPersonnelNo}</span>}
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{w.network}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{w.walletAddress}</td>
                      <td className="px-4 py-3"><WalletStatusBadge status={w.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(w.updatedAt), "MMM dd, HH:mm")}</td>
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
          <CardTitle className="text-base">Full Change History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Previous Address</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">New Address</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Changed At</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Note</th>
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
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No wallet changes recorded</td></tr>
                ) : (
                  [...(allLogs ?? [])].reverse().map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{log.userName ?? `User #${log.userId}`}</span>
                        {log.userPersonnelNo && <span className="ml-1.5 text-xs text-muted-foreground">#{log.userPersonnelNo}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.oldWalletAddress ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.newWalletAddress}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(log.changedAt), "MMM dd yyyy, HH:mm")}</td>
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
