import { useState } from "react";
import { useListDailyReports, useGetDailyReport, useUpdateDailyReport, getListDailyReportsQueryKey, getGetDailyReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ReportStatusBadge } from "@/components/status-badges";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, Eye, Film, AtSign, Clock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminReview() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useListDailyReports({ date });
  const { data: reportDetail } = useGetDailyReport(selectedReportId ?? 0, {
    query: { enabled: !!selectedReportId }
  });
  const updateMutation = useUpdateDailyReport();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListDailyReportsQueryKey({ date }) });
    if (selectedReportId) {
      queryClient.invalidateQueries({ queryKey: getGetDailyReportQueryKey(selectedReportId) });
    }
  }

  function updateStatus(id: number, status: string, note?: string) {
    updateMutation.mutate({ id, data: { status, adminNote: note ?? null } }, {
      onSuccess: () => {
        toast({ title: `Report marked as ${status}` });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  const groupedByUser = (reports ?? []).reduce((acc, r) => {
    const key = `${r.userId}-${r.userName ?? r.userId}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, typeof reports>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Review</h1>
          <p className="text-sm text-muted-foreground">Review and approve daily submissions</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (reports ?? []).length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No reports for {date}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByUser).map(([key, userReports]) => {
          const firstReport = userReports![0]!;
          return (
            <Card key={key} className="border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">{firstReport.userName ?? `User #${firstReport.userId}`}</CardTitle>
                    {firstReport.userPersonnelNo && (
                      <p className="text-sm text-muted-foreground">Personnel #{firstReport.userPersonnelNo}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {userReports!.map(report => (
                  <div key={report.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <ReportStatusBadge status={report.status} />
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Film className="h-3.5 w-3.5" />
                        <span>{report.itemCount} reels</span>
                      </div>
                      {report.adminNote && (
                        <p className="text-xs text-muted-foreground italic">Note: {report.adminNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setSelectedReportId(report.id)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {report.status !== "approved" && (
                        <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(report.id, "approved")}>
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      {report.status !== "missing" && (
                        <Button variant="outline" size="sm" className="gap-1.5 h-8 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => updateStatus(report.id, "missing")}>
                          <AlertCircle className="h-3.5 w-3.5" /> Missing
                        </Button>
                      )}
                      {report.status !== "rejected" && (
                        <Button variant="outline" size="sm" className="gap-1.5 h-8 border-red-300 text-red-700 hover:bg-red-50" onClick={() => updateStatus(report.id, "rejected")}>
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!selectedReportId} onOpenChange={open => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Report Detail — {reportDetail?.userName ?? `User #${reportDetail?.userId}`}
              {reportDetail?.userPersonnelNo ? ` (#${reportDetail.userPersonnelNo})` : ""}
            </DialogTitle>
          </DialogHeader>
          {reportDetail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ReportStatusBadge status={reportDetail.status} />
                <span className="text-sm text-muted-foreground">{reportDetail.date}</span>
                <span className="text-sm text-muted-foreground">{reportDetail.itemCount} reels</span>
              </div>

              {reportDetail.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No reels submitted</p>
              ) : (
                <div className="space-y-2">
                  {reportDetail.items.map(item => (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                      <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground font-medium">{item.instagramUsername ?? "unknown"}</span>
                        </div>
                        <a href={item.reelsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                          {item.reelsUrl}
                        </a>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {(() => { try { return format(new Date(item.enteredAt ?? item.createdAt), "dd.MM.yyyy HH:mm"); } catch { return item.enteredAt ?? item.createdAt; } })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Note</label>
                <Textarea
                  placeholder="Add a note..."
                  value={adminNote || reportDetail.adminNote || ""}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                  updateStatus(reportDetail.id, "approved", adminNote || reportDetail.adminNote || undefined);
                  setSelectedReportId(null);
                }}>
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => {
                  updateStatus(reportDetail.id, "missing", adminNote || undefined);
                  setSelectedReportId(null);
                }}>
                  <AlertCircle className="h-4 w-4" /> Mark Missing
                </Button>
                <Button variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => {
                  updateStatus(reportDetail.id, "rejected", adminNote || undefined);
                  setSelectedReportId(null);
                }}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                {adminNote && (
                  <Button variant="outline" onClick={() => {
                    updateMutation.mutate({ id: reportDetail.id, data: { adminNote } }, {
                      onSuccess: () => { toast({ title: "Note saved" }); invalidate(); setSelectedReportId(null); }
                    });
                  }}>
                    Save Note
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
