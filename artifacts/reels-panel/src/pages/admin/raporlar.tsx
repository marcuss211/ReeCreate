import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format, parseISO, isToday, isBefore, startOfToday } from "date-fns";
import { tr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Users, UserCheck, AlertTriangle, Clock,
  Film, CheckCircle2, Hourglass, XCircle,
  CreditCard, TrendingUp, TrendingDown, Minus,
  Download, BarChart3, ChevronUp, ChevronDown, ChevronsUpDown,
  Wallet, ShieldAlert, Activity,
} from "lucide-react";

// ─── Tipler ─────────────────────────────────────────────────────────────────
type Period = "daily" | "weekly" | "monthly" | "alltime";

interface Summary {
  period: Period;
  totalUsers: number; activeUsers: number;
  totalReels: number; approvedReels: number; pendingReels: number; rejectedReels: number;
  missingSubmissionUsers: number; delayedUsers: number;
  totalAgreements: number; totalAgreementAmount: number; totalPaid: number; totalRemaining: number;
  fullyPaidAgreements: number; partialPaidAgreements: number; unpaidAgreements: number;
}

interface UserPerf {
  id: number; name: string; username: string; status: string;
  totalAccounts: number; totalReports: number; approvedReports: number;
  rejectedReports: number; missingDays: number; delayCount: number;
  approvedReels: number; avgDailyReels: number; approvalRate: number;
  lastActivity: string | null;
}

interface TimelineEntry {
  date: string; approved: number; pending: number; rejected: number; missing: number; reels: number;
}

interface PaymentDetail {
  id: number; instagramAccounts: string; startDate: string; endDate: string;
  totalAmount: number; paidAmount: number; remaining: number;
  paymentStatus: "Ödenmedi" | "Kısmi Ödendi" | "Tam Ödendi";
  isExpired: boolean; isExpiring: boolean; updatedAt: string;
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function pct(a: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((a / total) * 100)}%`;
}

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Dönem etiketi ────────────────────────────────────────────────────────────
const PERIOD_LABELS: Record<Period, string> = {
  daily: "Günlük", weekly: "Haftalık", monthly: "Aylık", alltime: "Tüm Zamanlar",
};

// ─── Özet Kart ───────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, color = "text-foreground", loading }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; loading?: boolean;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{title}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            <Icon className={`h-5 w-5 flex-shrink-0 mt-1 ${color} opacity-80`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sıralama ikonu ──────────────────────────────────────────────────────────
type SortDir = "asc" | "desc";
function SortBtn({ col, sortCol, sortDir, onSort }: {
  col: string; sortCol: string | null; sortDir: SortDir; onSort: (c: string) => void;
}) {
  const active = sortCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`inline-flex items-center gap-0.5 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
    >
      {active
        ? sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
        : <ChevronsUpDown className="h-3 w-3 opacity-40" />
      }
    </button>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function AdminRaporlar() {
  const [period, setPeriod] = useState<Period>("alltime");
  const [userSortCol, setUserSortCol] = useState<string>("approvedReports");
  const [userSortDir, setUserSortDir] = useState<SortDir>("desc");
  const [paySortCol, setPaySortCol]   = useState<string | null>(null);
  const [paySortDir, setPaySortDir]   = useState<SortDir>("asc");

  function handleUserSort(col: string) {
    if (userSortCol === col) setUserSortDir(d => d === "asc" ? "desc" : "asc");
    else { setUserSortCol(col); setUserSortDir("desc"); }
  }
  function handlePaySort(col: string) {
    if (paySortCol === col) setPaySortDir(d => d === "asc" ? "desc" : "asc");
    else { setPaySortCol(col); setPaySortDir("asc"); }
  }

  const { data: summary, isLoading: sumLoading } = useQuery<Summary>({
    queryKey: ["reports-summary", period],
    queryFn: () => customFetch(`/api/reports/summary?period=${period}`),
  });

  const { data: userPerf, isLoading: perfLoading } = useQuery<UserPerf[]>({
    queryKey: ["reports-user-perf", period],
    queryFn: () => customFetch(`/api/reports/user-performance?period=${period}`),
  });

  const { data: timeline, isLoading: timeLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["reports-timeline", period],
    queryFn: () => customFetch(`/api/reports/timeline?period=${period}`),
  });

  const { data: payDetails, isLoading: payLoading } = useQuery<PaymentDetail[]>({
    queryKey: ["reports-payment-details"],
    queryFn: () => customFetch("/api/reports/payment-details"),
  });

  const { data: auditData } = useQuery<{
    recentAuditEvents: { id: number; actionType: string; targetType: string; targetId: number | null; createdAt: string }[];
    recentWalletChanges: { id: number; userId: number; changedAt: string }[];
    bulkFlagEvents: { userId: number; createdAt: string }[];
  }>({
    queryKey: ["reports-audit"],
    queryFn: () => customFetch("/api/reports/audit-events"),
  });

  // Sıralanmış kullanıcı tablosu
  const sortedUsers = useMemo(() => {
    if (!userPerf) return [];
    return [...userPerf].sort((a, b) => {
      const av = (a as any)[userSortCol] ?? 0;
      const bv = (b as any)[userSortCol] ?? 0;
      if (typeof av === "string") return userSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return userSortDir === "asc" ? av - bv : bv - av;
    });
  }, [userPerf, userSortCol, userSortDir]);

  // Sıralanmış ödeme tablosu
  const sortedPayments = useMemo(() => {
    if (!payDetails) return [];
    const base = [...payDetails];
    if (!paySortCol) return base;
    return base.sort((a, b) => {
      const av = (a as any)[paySortCol] ?? 0;
      const bv = (b as any)[paySortCol] ?? 0;
      if (typeof av === "string") return paySortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return paySortDir === "asc" ? av - bv : bv - av;
    });
  }, [payDetails, paySortCol, paySortDir]);

  // Pasta grafik verisi
  const pieData = summary ? [
    { name: "Onaylı", value: summary.approvedReels, color: "#22c55e" },
    { name: "Bekleyen", value: summary.pendingReels, color: "#f59e0b" },
    { name: "Reddedilen", value: summary.rejectedReels, color: "#ef4444" },
  ].filter(d => d.value > 0) : [];

  const payPieData = summary ? [
    { name: "Tam Ödendi", value: summary.fullyPaidAgreements, color: "#22c55e" },
    { name: "Kısmi", value: summary.partialPaidAgreements, color: "#3b82f6" },
    { name: "Ödenmedi", value: summary.unpaidAgreements, color: "#94a3b8" },
  ].filter(d => d.value > 0) : [];

  // En çok reels gönderen / eksik gönderen (top 5)
  const topSenders    = [...(userPerf ?? [])].sort((a, b) => b.approvedReels - a.approvedReels).slice(0, 5);
  const topMissing    = [...(userPerf ?? [])].sort((a, b) => b.missingDays - a.missingDays).filter(u => u.missingDays > 0).slice(0, 5);
  const topRejected   = [...(userPerf ?? [])].sort((a, b) => b.rejectedReports - a.rejectedReports).filter(u => u.rejectedReports > 0).slice(0, 5);

  // CSV dışa aktarma
  function exportUsers() {
    if (!sortedUsers.length) return;
    exportCSV(sortedUsers.map(u => ({
      "Kullanıcı Adı": u.username,
      "Ad Soyad": u.name,
      "Durum": u.status,
      "Hesap Sayısı": u.totalAccounts,
      "Toplam Rapor": u.totalReports,
      "Onaylı": u.approvedReports,
      "Reddedilen": u.rejectedReports,
      "Eksik Gün": u.missingDays,
      "Gecikme": u.delayCount,
      "Onaylı Reels": u.approvedReels,
      "Ort. Günlük Reels": u.avgDailyReels,
      "Onay Oranı %": u.approvalRate,
      "Son Aktivite": u.lastActivity ?? "",
    })), `kullanici-performans-${period}.csv`);
  }

  function exportPayments() {
    if (!sortedPayments.length) return;
    exportCSV(sortedPayments.map(p => ({
      "Instagram Hesapları": p.instagramAccounts,
      "Başlangıç": p.startDate,
      "Bitiş": p.endDate,
      "Toplam Tutar": p.totalAmount,
      "Ödenen": p.paidAmount,
      "Kalan": p.remaining,
      "Ödeme Durumu": p.paymentStatus,
    })), `odeme-raporu.csv`);
  }

  const thCls = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
  const tdCls = "px-3 py-2.5 text-sm whitespace-nowrap";

  return (
    <div className="space-y-8">
      {/* Başlık + Filtre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Raporlar
          </h1>
          <p className="text-sm text-muted-foreground">Detaylı sistem ve performans raporları</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["daily", "weekly", "monthly", "alltime"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── BÖLÜM 1: ÖZET KARTLAR ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kullanıcı Özeti</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Toplam Kullanıcı"    value={summary?.totalUsers ?? 0}             icon={Users}          loading={sumLoading} />
          <StatCard title="Aktif Kullanıcı"     value={summary?.activeUsers ?? 0}            icon={UserCheck}      color="text-green-600" loading={sumLoading} />
          <StatCard title="Eksik Gönderim"      value={summary?.missingSubmissionUsers ?? 0} icon={AlertTriangle}  color="text-amber-600" loading={sumLoading} sub={`${PERIOD_LABELS[period]}`} />
          <StatCard title="Gecikmeli Kullanıcı" value={summary?.delayedUsers ?? 0}           icon={Clock}          color="text-red-500"   loading={sumLoading} sub={`${PERIOD_LABELS[period]}`} />
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Reels Özeti</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Toplam Reels"   value={summary?.totalReels    ?? 0} icon={Film}          loading={sumLoading} sub={PERIOD_LABELS[period]} />
          <StatCard title="Onaylı Reels"   value={summary?.approvedReels ?? 0} icon={CheckCircle2}  color="text-green-600" loading={sumLoading} />
          <StatCard title="Bekleyen Reels" value={summary?.pendingReels  ?? 0} icon={Hourglass}     color="text-amber-600" loading={sumLoading} />
          <StatCard title="Reddedilen"     value={summary?.rejectedReels ?? 0} icon={XCircle}       color="text-red-500"   loading={sumLoading} />
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Ödeme Özeti</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard title="Toplam Anlaşma"   value={summary?.totalAgreements ?? 0}                              icon={CreditCard}    loading={sumLoading} />
          <StatCard title="Toplam Tutar"     value={summary ? fmt(summary.totalAgreementAmount) : "—"}          icon={TrendingUp}    loading={sumLoading} />
          <StatCard title="Toplam Ödenen"    value={summary ? fmt(summary.totalPaid) : "—"}                     icon={CheckCircle2}  color="text-green-600" loading={sumLoading} />
          <StatCard title="Toplam Kalan"     value={summary ? fmt(summary.totalRemaining) : "—"}                icon={TrendingDown}  color="text-amber-600" loading={sumLoading} />
          <StatCard title="Tam Ödendi"       value={summary?.fullyPaidAgreements ?? 0}                          icon={CheckCircle2}  color="text-green-600" loading={sumLoading}
            sub={`Kısmi: ${summary?.partialPaidAgreements ?? 0} / Ödenmedi: ${summary?.unpaidAgreements ?? 0}`} />
        </div>
      </section>

      {/* ── BÖLÜM 2: REELS GRAFİKLERİ ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Reels / Gönderim Raporu</h2>

        {/* Performans metrikleri */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Onay Oranı</p>
              <p className="text-2xl font-bold text-green-600">{pct(summary.approvedReels, summary.totalReels)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Red Oranı</p>
              <p className="text-2xl font-bold text-red-500">{pct(summary.rejectedReels, summary.totalReels)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Bekleyen Oran</p>
              <p className="text-2xl font-bold text-amber-600">{pct(summary.pendingReels, summary.totalReels)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Kullanıcı/Toplam</p>
              <p className="text-2xl font-bold">{summary.totalUsers > 0 ? (summary.totalReels / summary.totalUsers).toFixed(1) : "0"}</p>
            </CardContent></Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Zaman bazlı grafik */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Zaman Bazlı Gönderim Trendi</CardTitle>
            </CardHeader>
            <CardContent>
              {timeLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timeline ?? []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      tickFormatter={d => { try { return format(parseISO(d), "d MMM", { locale: tr }); } catch { return d; } }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={d => { try { return format(parseISO(d as string), "d MMMM yyyy", { locale: tr }); } catch { return String(d); } }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="approved" name="Onaylı" stroke="#22c55e" fill="#22c55e20" strokeWidth={2} />
                    <Area type="monotone" dataKey="pending"  name="Bekleyen" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                    <Area type="monotone" dataKey="rejected" name="Reddedilen" stroke="#ef4444" fill="#ef444420" strokeWidth={2} />
                    <Area type="monotone" dataKey="missing"  name="Eksik" stroke="#94a3b8" fill="#94a3b820" strokeWidth={1} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Dağılım pasta grafiği */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Reels Durum Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              {sumLoading ? <Skeleton className="h-48 w-full" /> : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Veri yok</div>}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 listeleri */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { title: "En Çok Reels Gönderen", list: topSenders,  key: "approvedReels",   label: "reels", color: "text-green-600" },
            { title: "En Çok Eksik Gönderen", list: topMissing,  key: "missingDays",     label: "gün",   color: "text-amber-600" },
            { title: "En Çok Reddedilen",     list: topRejected, key: "rejectedReports", label: "red",   color: "text-red-500" },
          ].map(({ title, list, key, label, color }) => (
            <Card key={title}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {perfLoading ? <div className="p-4"><Skeleton className="h-32 w-full" /></div> :
                  list.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Veri yok</p> :
                  <div className="divide-y divide-border">
                    {list.map((u, i) => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${color}`}>{(u as any)[key]} <span className="font-normal text-xs text-muted-foreground">{label}</span></span>
                      </div>
                    ))}
                  </div>
                }
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── BÖLÜM 3: KULLANICI PERFORMANS TABLOSU ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold border-b border-border pb-2 flex-1">Kullanıcı Performans Tablosu</h2>
          <Button variant="outline" size="sm" onClick={exportUsers} className="gap-1.5 ml-4">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    { label: "Kullanıcı", col: "name" },
                    { label: "Durum", col: "status" },
                    { label: "Hesap", col: "totalAccounts" },
                    { label: "Rapor", col: "totalReports" },
                    { label: "Onaylı", col: "approvedReports" },
                    { label: "Reddedilen", col: "rejectedReports" },
                    { label: "Eksik Gün", col: "missingDays" },
                    { label: "Gecikme", col: "delayCount" },
                    { label: "Onaylı Reels", col: "approvedReels" },
                    { label: "Onay Oranı", col: "approvalRate" },
                    { label: "Son Aktivite", col: "lastActivity" },
                  ].map(({ label, col }) => (
                    <th key={col} className={thCls}>
                      <div className="flex items-center gap-1">
                        {label}
                        <SortBtn col={col} sortCol={userSortCol} sortDir={userSortDir} onSort={handleUserSort} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfLoading ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 11 }).map((_, j) => <td key={j} className={tdCls}><Skeleton className="h-4 w-16" /></td>)}
                  </tr>
                )) : sortedUsers.length === 0 ? (
                  <tr><td colSpan={11} className="py-8 text-center text-muted-foreground">Veri yok</td></tr>
                ) : sortedUsers.map(u => (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                    <td className={tdCls}>
                      <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">@{u.username}</p></div>
                    </td>
                    <td className={tdCls}>
                      <Badge className={u.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}>
                        {u.status === "active" ? "Aktif" : "Pasif"}
                      </Badge>
                    </td>
                    <td className={`${tdCls} text-center`}>{u.totalAccounts}</td>
                    <td className={`${tdCls} text-center`}>{u.totalReports}</td>
                    <td className={`${tdCls} text-center font-medium text-green-700`}>{u.approvedReports}</td>
                    <td className={`${tdCls} text-center ${u.rejectedReports > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{u.rejectedReports}</td>
                    <td className={`${tdCls} text-center ${u.missingDays > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>{u.missingDays}</td>
                    <td className={`${tdCls} text-center ${u.delayCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{u.delayCount}</td>
                    <td className={`${tdCls} text-center font-semibold`}>{u.approvedReels}</td>
                    <td className={`${tdCls} text-center`}>
                      <span className={u.approvalRate >= 80 ? "text-green-600 font-medium" : u.approvalRate >= 50 ? "text-amber-600" : "text-red-500 font-medium"}>
                        {u.approvalRate}%
                      </span>
                    </td>
                    <td className={`${tdCls} text-muted-foreground`}>
                      {u.lastActivity ? format(parseISO(u.lastActivity), "d MMM yyyy", { locale: tr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* ── BÖLÜM 4: ÖDEME / ANLAŞMA RAPORU ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold border-b border-border pb-2 flex-1">Ödeme / Anlaşma Raporu</h2>
          <Button variant="outline" size="sm" onClick={exportPayments} className="gap-1.5 ml-4">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        {/* Yaklaşan + süresi dolan anlaşmalar */}
        {payDetails && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Yaklaşan Bitişler (7 gün)</CardTitle></CardHeader>
              <CardContent className="p-0">
                {payDetails.filter(p => p.isExpiring).length === 0
                  ? <p className="px-4 pb-3 text-sm text-muted-foreground">Yok</p>
                  : <div className="divide-y divide-border">
                    {payDetails.filter(p => p.isExpiring).map(p => (
                      <div key={p.id} className="flex justify-between px-4 py-2 text-sm">
                        <span className="font-mono text-xs">{p.instagramAccounts.split(",")[0]?.trim()}</span>
                        <span className="text-amber-600">{format(parseISO(p.endDate), "d MMM", { locale: tr })}</span>
                      </div>
                    ))}
                  </div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm text-red-500 flex items-center gap-1"><XCircle className="h-4 w-4" /> Süresi Dolmuş</CardTitle></CardHeader>
              <CardContent className="p-0">
                {payDetails.filter(p => p.isExpired && p.paymentStatus !== "Tam Ödendi").length === 0
                  ? <p className="px-4 pb-3 text-sm text-muted-foreground">Yok</p>
                  : <div className="divide-y divide-border">
                    {payDetails.filter(p => p.isExpired && p.paymentStatus !== "Tam Ödendi").slice(0, 5).map(p => (
                      <div key={p.id} className="flex justify-between px-4 py-2 text-sm">
                        <span className="font-mono text-xs">{p.instagramAccounts.split(",")[0]?.trim()}</span>
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">{p.paymentStatus}</Badge>
                      </div>
                    ))}
                  </div>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ödeme durumu pasta grafiği + bar grafik */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ödeme Durumu Dağılımı</CardTitle></CardHeader>
            <CardContent>
              {payLoading ? <Skeleton className="h-48 w-full" /> : payPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={payPieData} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {payPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Veri yok</div>}
            </CardContent>
          </Card>

          {/* En yüksek bütçeli anlaşmalar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">En Yüksek Bütçeli Anlaşmalar</CardTitle></CardHeader>
            <CardContent>
              {payLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(payDetails ?? []).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 6)} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="instagramAccounts" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end"
                      tickFormatter={v => v.split(",")[0]?.trim()?.replace(/^@/, "") ?? v} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₺${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => [fmt(v), ""]} />
                    <Bar dataKey="totalAmount" name="Toplam" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paidAmount"  name="Ödenen" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ödeme detay tablosu */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    { label: "Instagram Hesapları", col: "instagramAccounts" },
                    { label: "Başlangıç", col: "startDate" },
                    { label: "Bitiş", col: "endDate" },
                    { label: "Toplam Tutar", col: "totalAmount" },
                    { label: "Ödenen", col: "paidAmount" },
                    { label: "Kalan", col: "remaining" },
                    { label: "Ödeme Durumu", col: "paymentStatus" },
                    { label: "Son Güncelleme", col: "updatedAt" },
                  ].map(({ label, col }) => (
                    <th key={col} className={thCls}>
                      <div className="flex items-center gap-1">
                        {label}
                        <SortBtn col={col} sortCol={paySortCol} sortDir={paySortDir} onSort={handlePaySort} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((_, j) => <td key={j} className={tdCls}><Skeleton className="h-4 w-16" /></td>)}
                  </tr>
                )) : sortedPayments.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Veri yok</td></tr>
                ) : sortedPayments.map(p => (
                  <tr key={p.id} className={`border-b border-border hover:bg-muted/30 ${p.paymentStatus === "Tam Ödendi" ? "bg-green-50/40" : p.isExpired ? "bg-red-50/30" : ""}`}>
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-1">
                        {p.instagramAccounts.split(",").map(s => s.trim()).filter(Boolean).map((acc, i) => (
                          <span key={i} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{acc}</span>
                        ))}
                      </div>
                    </td>
                    <td className={`${tdCls} text-muted-foreground`}>{format(parseISO(p.startDate), "d MMM yyyy", { locale: tr })}</td>
                    <td className={`${tdCls} ${p.isExpired ? "text-red-500" : p.isExpiring ? "text-amber-600" : "text-muted-foreground"}`}>
                      {format(parseISO(p.endDate), "d MMM yyyy", { locale: tr })}
                      {p.isExpiring && <span className="ml-1 text-xs">(Yakın)</span>}
                      {p.isExpired  && <span className="ml-1 text-xs">(Doldu)</span>}
                    </td>
                    <td className={`${tdCls} text-right font-medium tabular-nums`}>{p.totalAmount > 0 ? fmt(p.totalAmount) : "—"}</td>
                    <td className={`${tdCls} text-right tabular-nums text-green-700`}>{p.paidAmount > 0 ? fmt(p.paidAmount) : "—"}</td>
                    <td className={`${tdCls} text-right tabular-nums ${p.remaining > 0 ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                      {p.remaining > 0 ? fmt(p.remaining) : "₺0"}
                    </td>
                    <td className={tdCls}>
                      {p.paymentStatus === "Tam Ödendi"
                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1 pl-1.5"><CheckCircle2 className="h-3 w-3" />Tam Ödendi</Badge>
                        : p.paymentStatus === "Kısmi Ödendi"
                          ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Kısmi Ödendi</Badge>
                          : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Ödenmedi</Badge>
                      }
                    </td>
                    <td className={`${tdCls} text-muted-foreground`}>
                      {format(parseISO(p.updatedAt), "d MMM yyyy", { locale: tr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* ── BÖLÜM 5: SİSTEM / RİSK ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">Sistem ve Risk Raporu</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Son 24h audit olayları */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Son 24 Saat Olaylar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!auditData
                ? <div className="px-4 pb-3"><Skeleton className="h-32 w-full" /></div>
                : auditData.recentAuditEvents.length === 0
                  ? <p className="px-4 pb-3 text-sm text-muted-foreground">Olay yok</p>
                  : <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {auditData.recentAuditEvents.map(e => (
                      <div key={e.id} className="px-4 py-2 text-xs">
                        <span className="font-medium">{e.actionType}</span>
                        <span className="text-muted-foreground"> → {e.targetType}</span>
                        <div className="text-muted-foreground">{format(parseISO(e.createdAt), "HH:mm", { locale: tr })}</div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>

          {/* Cüzdan değişimleri */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-amber-600" /> Cüzdan Değişimleri (24s)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!auditData
                ? <div className="px-4 pb-3"><Skeleton className="h-32 w-full" /></div>
                : auditData.recentWalletChanges.length === 0
                  ? <p className="px-4 pb-3 text-sm text-muted-foreground">Değişim yok</p>
                  : <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {auditData.recentWalletChanges.map(e => (
                      <div key={e.id} className="px-4 py-2 text-xs">
                        <span className="font-medium">Kullanıcı #{e.userId}</span>
                        <div className="text-muted-foreground">{format(parseISO(e.changedAt), "d MMM HH:mm", { locale: tr })}</div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>

          {/* Toplu giriş şüphesi */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-500" /> Toplu Giriş Şüphesi (7g)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!auditData
                ? <div className="px-4 pb-3"><Skeleton className="h-32 w-full" /></div>
                : auditData.bulkFlagEvents.length === 0
                  ? <p className="px-4 pb-3 text-sm text-green-600 font-medium">Şüpheli olay yok ✓</p>
                  : <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {auditData.bulkFlagEvents.map((e, i) => (
                      <div key={i} className="px-4 py-2 text-xs">
                        <span className="text-red-600 font-medium">Kullanıcı #{e.userId}</span>
                        <div className="text-muted-foreground">{format(parseISO(e.createdAt), "d MMM HH:mm", { locale: tr })}</div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
