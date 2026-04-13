import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, CheckCircle2, AlertCircle, Film,
  Clock, XCircle, Timer, Flag, Wallet, Star,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

type Period = "daily" | "weekly" | "monthly" | "alltime";

interface DashboardSummary {
  period: Period;
  totalUsers: number;
  activeUsers: number;
  submittedCount: number;
  missingCount: number;
  totalReelsCount: number;
  totalApprovedReels: number;
  pendingApprovals: number;
  rejectedItems: number;
  delayedUsers: number;
  bulkFlaggedUsers: number;
  walletChanges: number;
}

interface DailyActivityPoint {
  date: string;
  submitted: number;
  missing: number;
  reelsCount: number;
}

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

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "alltime", label: "Tüm Zamanlar" },
];

// Dönem → grafik bar sayısı
const PERIOD_DAYS: Record<Period, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  alltime: 90,
};

// Dönem → gönderim kartı etiketi
const PERIOD_LABELS: Record<Period, string> = {
  daily: "Bugün",
  weekly: "Son 7 Gün",
  monthly: "Son 30 Gün",
  alltime: "Tüm Zamanlar",
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("daily");

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary", period],
    queryFn: () => customFetch<DashboardSummary>(`/api/dashboard/summary?period=${period}`),
    staleTime: 30_000,
  });

  const { data: activity, isLoading: activityLoading } = useQuery<DailyActivityPoint[]>({
    queryKey: ["dashboard-activity", period],
    queryFn: () =>
      customFetch<DailyActivityPoint[]>(
        `/api/dashboard/daily-activity?period=${period}&days=${PERIOD_DAYS[period]}`
      ),
    staleTime: 30_000,
  });

  const label = PERIOD_LABELS[period];

  const chartData = (activity ?? []).map(d => ({
    tarih: format(parseISO(d.date), PERIOD_DAYS[period] > 30 ? "d MMM" : "d MMM", { locale: tr }),
    "Gönderildi": d.submitted,
    "Eksik": d.missing,
    "Reel": d.reelsCount,
  }));

  const chartTitle =
    period === "daily" ? "Bugünkü Gönderim Aktivitesi"
    : period === "weekly" ? "Son 7 Günlük Gönderim Aktivitesi"
    : period === "monthly" ? "Son 30 Günlük Gönderim Aktivitesi"
    : "Son 90 Günlük Gönderim Trendi";

  return (
    <div className="space-y-6">
      {/* Başlık + Filtre */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {label} aktiviteye genel bakış
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-3 text-xs font-medium transition-all ${
                period === opt.value ? "" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Birinci satır: kullanıcı + gönderim metrikleri */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Toplam Kullanıcı"
          value={summary?.totalUsers}
          icon={<Users className="h-5 w-5 text-white" />}
          colorClass="bg-primary"
          isLoading={summaryLoading}
        />
        <StatCard
          title="Aktif Kullanıcı"
          value={summary?.activeUsers}
          icon={<UserCheck className="h-5 w-5 text-white" />}
          colorClass="bg-emerald-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title={`${label} Gönderilen`}
          value={summary?.submittedCount}
          icon={<CheckCircle2 className="h-5 w-5 text-white" />}
          colorClass="bg-blue-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title={`${label} Eksik`}
          value={summary?.missingCount}
          icon={<AlertCircle className="h-5 w-5 text-white" />}
          colorClass="bg-amber-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title={`${label} Reel`}
          value={summary?.totalReelsCount}
          icon={<Film className="h-5 w-5 text-white" />}
          colorClass="bg-violet-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title="Toplam Onaylı Reels"
          value={summary?.totalApprovedReels}
          icon={<Star className="h-5 w-5 text-white" />}
          colorClass="bg-green-600"
          isLoading={summaryLoading}
        />
      </div>

      {/* İkinci satır: durum/uyarı metrikleri */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Onay Bekleyen"
          value={summary?.pendingApprovals}
          icon={<Clock className="h-5 w-5 text-white" />}
          colorClass="bg-orange-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title="Reddedilen"
          value={summary?.rejectedItems}
          icon={<XCircle className="h-5 w-5 text-white" />}
          colorClass="bg-red-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title="Gecikmeli Kullanıcı"
          value={summary?.delayedUsers}
          icon={<Timer className="h-5 w-5 text-white" />}
          colorClass="bg-yellow-500"
          isLoading={summaryLoading}
        />
        <StatCard
          title="Toplu Giriş Şüphesi"
          value={summary?.bulkFlaggedUsers}
          icon={<Flag className="h-5 w-5 text-white" />}
          colorClass="bg-red-600"
          isLoading={summaryLoading}
        />
        <StatCard
          title={period === "daily" ? "Cüzdan Değişimi (24s)" : `${label} Cüzdan Değişimi`}
          value={summary?.walletChanges}
          icon={<Wallet className="h-5 w-5 text-white" />}
          colorClass="bg-slate-500"
          isLoading={summaryLoading}
        />
      </div>

      {/* Aktivite grafiği */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{chartTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Bu dönem için veri bulunamadı
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="tarih"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={PERIOD_DAYS[period] > 14 ? "preserveStartEnd" : 0}
                />
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
