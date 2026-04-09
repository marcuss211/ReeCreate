import { useListDailyReports } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReportStatusBadge } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, MessageSquare, AlertCircle, History } from "lucide-react";
import { format } from "date-fns";

export default function UserHistory() {
  const { data: reports, isLoading } = useListDailyReports({});
  const sorted = [...(reports ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Submission History</h1>
        <p className="text-sm text-muted-foreground">Your past daily reports</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : sorted.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No submission history yet
          </CardContent>
        </Card>
      ) : (
        <Card className="border-card-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {sorted.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-muted/30 transition-colors flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{format(new Date(r.date), "EEEE, MMM dd, yyyy")}</span>
                      <ReportStatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Film className="h-3 w-3" />
                        {r.itemCount} reel{r.itemCount !== 1 ? "s" : ""}
                      </span>
                      {r.submittedAt && (
                        <span>Submitted: {format(new Date(r.submittedAt), "HH:mm")}</span>
                      )}
                      {r.approvedAt && (
                        <span>Approved: {format(new Date(r.approvedAt), "MMM dd HH:mm")}</span>
                      )}
                    </div>
                    {r.adminNote && (
                      <div className="flex items-start gap-1.5 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 mt-1">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700">{r.adminNote}</p>
                      </div>
                    )}
                    {(r.status === "late" || r.status === "bulk_flagged") && (
                      <div className="flex items-center gap-1.5 text-xs text-orange-600">
                        <AlertCircle className="h-3 w-3" />
                        {r.status === "late" ? "This report was submitted late" : "Bulk entry detected"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
