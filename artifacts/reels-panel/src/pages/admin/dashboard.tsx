import { useGetDashboardSummary, useGetDailyActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, CheckCircle2, AlertCircle, Film, Clock, XCircle, Timer, Flag, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

interface StatCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  colorClass: string;
  isLoading: boolean;
}

function StatCard({ title, value, icon, colorClass, isLoading }: StatCardProps) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-8 w-16" />
            ) : (
              <p className="mt-1 text-3xl font-bold">{value ?? 0}</p>
            )}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: activityLoading } = useGetDailyActivity({ days: 14 });

  const chartData = activity?.map(d => ({
    tarih: format(parseISO(d.date), "d MMM", { locale: tr }),
    "Gönderildi": d.submitted,
    "Eksik": d.missing,
    "Reel": d.reelsCount,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bugünkü aktiviteye genel bakış</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Toplam Kullanıcı" value={summary?.totalUsers} icon={<Users className="h-5 w-5 text-white" />} colorClass="bg-primary" isLoading={summaryLoading} />
        <StatCard title="Aktif Kullanıcı" value={summary?.activeUsers} icon={<UserCheck className="h-5 w-5 text-white" />} colorClass="bg-emerald-500" isLoading={summaryLoading} />
        <StatCard title="Bugün Gönderilen" value={summary?.todaySubmittedCount} icon={<CheckCircle2 className="h-5 w-5 text-white" />} colorClass="bg-blue-500" isLoading={summaryLoading} />
        <StatCard title="Bugün Eksik" value={summary?.todayMissingCount} icon={<AlertCircle className="h-5 w-5 text-white" />} colorClass="bg-amber-500" isLoading={summaryLoading} />
        <StatCard title="Bugün Reel" value={summary?.totalReelsTodayCount} icon={<Film className="h-5 w-5 text-white" />} colorClass="bg-violet-500" isLoading={summaryLoading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Onay Bekleyen" value={summary?.pendingApprovals} icon={<Clock className="h-5 w-5 text-white" />} colorClass="bg-orange-500" isLoading={summaryLoading} />
        <StatCard title="Reddedilen" value={summary?.rejectedItems} icon={<XCircle className="h-5 w-5 text-white" />} colorClass="bg-red-500" isLoading={summaryLoading} />
        <StatCard title="Gecikmeli Kullanıcı" value={summary?.delayedUsers} icon={<Timer className="h-5 w-5 text-white" />} colorClass="bg-yellow-500" isLoading={summaryLoading} />
        <StatCard title="Toplu Giriş Şüphesi" value={summary?.bulkFlaggedUsers} icon={<Flag className="h-5 w-5 text-white" />} colorClass="bg-red-600" isLoading={summaryLoading} />
        <StatCard title="Cüzdan Değişimi (24s)" value={summary?.walletChanges24h} icon={<Wallet className="h-5 w-5 text-white" />} colorClass="bg-slate-500" isLoading={summaryLoading} />
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">14 Günlük Gönderim Aktivitesi</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tarih" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Bar dataKey="Gönderildi" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Eksik" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Reel" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
