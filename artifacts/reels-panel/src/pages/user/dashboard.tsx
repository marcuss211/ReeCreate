import { useGetUserDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportStatusBadge } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AtSign, AlertCircle, Wallet, PlusCircle, Hash } from "lucide-react";

export default function UserDashboard() {
  const { data, isLoading } = useGetUserDashboardSummary();

  return (
    <div className="space-y-6">
      <div>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {data?.name}</h1>
            {data?.personnelNo && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Hash className="h-3.5 w-3.5" />
                Personnel Number: <span className="font-mono font-semibold">#{data.personnelNo}</span>
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-card-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Today's Status</p>
            <div className="mt-2">
              {isLoading ? <Skeleton className="h-6 w-24" /> : (
                data?.todayStatus ? <ReportStatusBadge status={data.todayStatus} /> : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-600">Not submitted</Badge>
                )
              )}
            </div>
            <Link href="/entry">
              <Button size="sm" className="mt-3 gap-1.5 w-full">
                <PlusCircle className="h-3.5 w-3.5" />
                {data?.todayStatus === "submitted" || data?.todayStatus === "approved" ? "View Entry" : "Submit Today"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Missing Days</p>
            <div className="mt-2 flex items-center gap-2">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <>
                  <span className={`text-3xl font-bold ${(data?.missingDaysCount ?? 0) > 0 ? "text-orange-600" : "text-foreground"}`}>
                    {data?.missingDaysCount ?? 0}
                  </span>
                  {(data?.missingDaysCount ?? 0) > 0 && <AlertCircle className="h-5 w-5 text-orange-500" />}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Wallet (Cekim)</p>
            <div className="mt-2">
              {isLoading ? <Skeleton className="h-6 w-32" /> : (
                data?.walletAddress ? (
                  <p className="font-mono text-sm truncate">{data.walletAddress.slice(0, 12)}...</p>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Not set</Badge>
                )
              )}
            </div>
            <Link href="/cekim">
              <Button size="sm" variant="outline" className="mt-3 gap-1.5 w-full">
                <Wallet className="h-3.5 w-3.5" />
                {data?.walletAddress ? "Manage Wallet" : "Add Wallet"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Assigned Instagram Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (data?.instagramAccounts.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts assigned yet</p>
          ) : (
            <div className="space-y-2">
              {data?.instagramAccounts.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{a.instagramUsername}</span>
                  <Badge variant={a.status === "active" ? "default" : "secondary"} className={`ml-auto text-xs ${a.status === "active" ? "bg-green-100 text-green-800" : ""}`}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(data?.adminNotes?.length ?? 0) > 0 && (
        <Card className="border-card-border border-l-4 border-l-blue-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Admin Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.adminNotes.map((note, i) => (
              <p key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{note}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
