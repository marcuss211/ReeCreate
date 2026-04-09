import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, History } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-100 text-blue-800",
  logout: "bg-gray-100 text-gray-700",
  create_user: "bg-green-100 text-green-800",
  update_user: "bg-yellow-100 text-yellow-800",
  reset_password: "bg-orange-100 text-orange-800",
  create_instagram_account: "bg-violet-100 text-violet-800",
  update_instagram_account: "bg-violet-100 text-violet-800",
  update_daily_report: "bg-blue-100 text-blue-800",
  update_wallet_address: "bg-red-100 text-red-800",
};

export default function AdminAudit() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useListAuditLogs({ limit: 200 });

  const filtered = (logs ?? []).filter(l =>
    (l.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    l.actionType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">All system actions tracked for security</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by user or action..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <History className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  filtered.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.createdAt), "MMM dd, HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3 font-medium">{l.userName ?? `User #${l.userId}`}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${ACTION_COLORS[l.actionType] ?? "bg-gray-100 text-gray-700"}`}>
                          {l.actionType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {l.targetType ? `${l.targetType} #${l.targetId}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.ipAddress ?? "—"}</td>
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
