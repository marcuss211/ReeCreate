import { useState, useEffect } from "react";
import { useListInstagramAccounts, useCreateDailyReport, useGetDailyReport, useUpdateDailyReport, useCreateReportItem, useDeleteReportItem, getGetDailyReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportStatusBadge } from "@/components/status-badges";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle, Save, AtSign, Film, AlertCircle, Link } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const REELS_PATTERN = /instagram\.com\/reel(?:s)?\/[A-Za-z0-9_-]+/;

export default function UserEntry() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [reportId, setReportId] = useState<number | null>(null);
  const [newUrls, setNewUrls] = useState<Record<number, string>>({});
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    // Create or fetch report for selected date
    createReportMutation.mutate({ data: { date } }, {
      onSuccess: (report) => setReportId(report.id),
    });
  }, [date]);

  function invalidate() {
    if (reportId) queryClient.invalidateQueries({ queryKey: getGetDailyReportQueryKey(reportId) });
  }

  function validateUrl(url: string): string | null {
    if (!url.trim()) return "URL is required";
    if (!REELS_PATTERN.test(url)) return "Must be a valid Instagram Reels URL (instagram.com/reel/...)";
    return null;
  }

  function handleAddItem(accountId: number) {
    if (!reportId) return;
    const url = (newUrls[accountId] ?? "").trim();
    const error = validateUrl(url);
    if (error) {
      setUrlErrors(prev => ({ ...prev, [accountId]: error }));
      return;
    }

    addItemMutation.mutate({
      data: {
        reportId,
        instagramAccountId: accountId,
        reelsUrl: url,
        contentDate: date,
      }
    }, {
      onSuccess: () => {
        setNewUrls(prev => ({ ...prev, [accountId]: "" }));
        setUrlErrors(prev => ({ ...prev, [accountId]: "" }));
        invalidate();
        toast({ title: "Reel added" });
      },
      onError: (e: any) => {
        setUrlErrors(prev => ({ ...prev, [accountId]: e?.message ?? "Failed to add" }));
      }
    });
  }

  function handleDelete(itemId: number) {
    deleteItemMutation.mutate({ id: itemId }, {
      onSuccess: () => { invalidate(); toast({ title: "Reel removed" }); },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function handleSubmit() {
    if (!reportId) return;
    updateMutation.mutate({ id: reportId, data: { status: "submitted" } }, {
      onSuccess: () => {
        toast({ title: "Report submitted", description: "Your daily report has been submitted for review." });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  const isSubmitted = reportDetail?.status === "submitted" || reportDetail?.status === "approved";
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
          <h1 className="text-2xl font-bold tracking-tight">Daily Entry</h1>
          <p className="text-sm text-muted-foreground">Submit your daily Instagram Reels links</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-44" />
          {reportDetail && <ReportStatusBadge status={reportDetail.status} />}
        </div>
      </div>

      {accountsLoading || reportLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : activeAccounts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AtSign className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No Instagram accounts assigned to you yet
          </CardContent>
        </Card>
      ) : (
        activeAccounts.map(account => {
          const accountItems = itemsByAccount[account.id] ?? [];
          return (
            <Card key={account.id} className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  {account.instagramUsername}
                  <Badge variant="outline" className="ml-auto text-xs">
                    <Film className="h-3 w-3 mr-1" />
                    {accountItems.length} reel{accountItems.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5">
                    <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={item.reelsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                      {item.reelsUrl}
                    </a>
                    {!isSubmitted && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteItemMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}

                {!isSubmitted && (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.instagram.com/reel/..."
                        value={newUrls[account.id] ?? ""}
                        onChange={e => {
                          setNewUrls(prev => ({ ...prev, [account.id]: e.target.value }));
                          setUrlErrors(prev => ({ ...prev, [account.id]: "" }));
                        }}
                        onKeyDown={e => e.key === "Enter" && handleAddItem(account.id)}
                        className={urlErrors[account.id] ? "border-red-400" : ""}
                      />
                      <Button size="sm" className="gap-1.5 shrink-0" onClick={() => handleAddItem(account.id)} disabled={addItemMutation.isPending}>
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                    {urlErrors[account.id] && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {urlErrors[account.id]}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {!isSubmitted && activeAccounts.length > 0 && reportDetail && (
        <div className="flex gap-3 pt-2">
          <Button className="gap-2" onClick={handleSubmit} disabled={updateMutation.isPending}>
            <CheckCircle className="h-4 w-4" />
            Submit for Today
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            <Save className="h-4 w-4" />
            Auto-saved as Draft
          </Button>
        </div>
      )}

      {isSubmitted && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-700">
            Report submitted successfully. Awaiting admin review.
          </p>
        </div>
      )}
    </div>
  );
}
