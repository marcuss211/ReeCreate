import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  dailyReportsTable,
  reportItemsTable,
  walletAddressLogsTable,
  delayFlagsTable,
  instagramAccountsTable,
  walletAddressesTable,
} from "@workspace/db";
import { eq, gte, sql, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

type Period = "daily" | "weekly" | "monthly" | "alltime";

// Dönem → en eski dahil edilecek tarih string'i (YYYY-MM-DD), daily_reports.date ile karşılaştırılır
function getFromDateStr(period: Period): string | null {
  const now = new Date();
  if (period === "daily") return now.toISOString().split("T")[0];
  if (period === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  }
  if (period === "monthly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return d.toISOString().split("T")[0];
  }
  return null; // alltime → filtre yok
}

// Dönem → timestamp (wallet_address_logs.changed_at ve delay_flags.created_at için)
function getFromTimestamp(period: Period): Date | null {
  const now = new Date();
  if (period === "daily") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "monthly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

// Dönem → grafik için kaç gün gösterileceği
function getPeriodDays(period: Period): number {
  if (period === "daily") return 1;
  if (period === "weekly") return 7;
  if (period === "monthly") return 30;
  return 90; // alltime → son 90 gün trend
}

router.get("/dashboard/summary", requireAdmin, async (req, res): Promise<void> => {
  const rawPeriod = req.query.period as string;
  const period: Period = ["daily", "weekly", "monthly", "alltime"].includes(rawPeriod)
    ? (rawPeriod as Period)
    : "daily";

  const fromDateStr = getFromDateStr(period);
  const fromTs = getFromTimestamp(period);

  // Toplam ve aktif kullanıcı sayısı — dönem bağımsız (anlık snapshot)
  const [totalUsers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "user"));

  const [activeUsers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.role, "user"), eq(usersTable.status, "active")));

  // Seçilen döneme ait daily_reports
  const reports = fromDateStr
    ? await db.select().from(dailyReportsTable).where(gte(dailyReportsTable.date, fromDateStr))
    : await db.select().from(dailyReportsTable);

  // Gönderildi: submitted + approved + late + bulk_flagged statüsü
  const submittedCount = reports.filter(r =>
    ["submitted", "approved", "late", "bulk_flagged"].includes(r.status)
  ).length;

  // Eksik: missing statüsü
  const missingCount = reports.filter(r => r.status === "missing").length;

  // Onay bekleyen: submitted statüsü
  const pendingApprovals = reports.filter(r => r.status === "submitted").length;

  // Reddedilen: rejected statüsü
  const rejectedItems = reports.filter(r => r.status === "rejected").length;

  // Onaylanmış rapor ID'leri (approvedReels hesabı için)
  const approvedReportIds = reports.filter(r => r.status === "approved").map(r => r.id);

  // Dönemdeki toplam reel kaydı (content_date bazlı)
  const reelsQuery = fromDateStr
    ? db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(gte(reportItemsTable.contentDate, fromDateStr))
    : db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable);
  const [reelsResult] = await reelsQuery;
  const totalReelsCount = reelsResult?.count ?? 0;

  // Dönemde onaylanmış raporlara ait toplam reel sayısı
  let totalApprovedReels = 0;
  if (approvedReportIds.length > 0) {
    const [approvedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportItemsTable)
      .where(inArray(reportItemsTable.reportId, approvedReportIds));
    totalApprovedReels = approvedResult?.count ?? 0;
  }

  // Cüzdan değişimi — dönem başından itibaren
  const walletQuery = fromTs
    ? db.select({ count: sql<number>`count(*)::int` }).from(walletAddressLogsTable).where(gte(walletAddressLogsTable.changedAt, fromTs))
    : db.select({ count: sql<number>`count(*)::int` }).from(walletAddressLogsTable);
  const [walletResult] = await walletQuery;
  const walletChanges = walletResult?.count ?? 0;

  // Gecikmeli kullanıcılar: delay_day_count > 2 olan bayraklar
  const delayedFlagsQuery = fromTs
    ? db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable)
        .where(and(sql`${delayFlagsTable.delayDayCount} > 2`, gte(delayFlagsTable.createdAt, fromTs)))
    : db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable)
        .where(sql`${delayFlagsTable.delayDayCount} > 2`);
  const delayedFlags = await delayedFlagsQuery;
  const delayedUsers = new Set(delayedFlags.map(f => f.userId)).size;

  // Toplu giriş şüphesi: is_bulk_entry_flag = 1
  const bulkQuery = fromTs
    ? db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable)
        .where(and(eq(delayFlagsTable.isBulkEntryFlag, 1), gte(delayFlagsTable.createdAt, fromTs)))
    : db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable)
        .where(eq(delayFlagsTable.isBulkEntryFlag, 1));
  const bulkFlags = await bulkQuery;
  const bulkFlaggedUsers = new Set(bulkFlags.map(f => f.userId)).size;

  res.json({
    period,
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    submittedCount,
    missingCount,
    totalReelsCount,
    totalApprovedReels,
    pendingApprovals,
    rejectedItems,
    delayedUsers,
    bulkFlaggedUsers,
    walletChanges,
  });
});

router.get("/dashboard/user-summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const today = new Date().toISOString().split("T")[0];

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const accounts = await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.userId, userId));

  const approvedCountRows = await db
    .select({
      instagramAccountId: reportItemsTable.instagramAccountId,
      count: sql<number>`count(*)::int`,
    })
    .from(reportItemsTable)
    .innerJoin(dailyReportsTable, eq(reportItemsTable.reportId, dailyReportsTable.id))
    .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.status, "approved")))
    .groupBy(reportItemsTable.instagramAccountId);

  const approvedByAccount: Record<number, number> = {};
  for (const row of approvedCountRows) {
    approvedByAccount[row.instagramAccountId] = row.count;
  }

  const accountsWithCount = accounts.map(a => ({
    ...a,
    approvedReelsCount: approvedByAccount[a.id] ?? 0,
  }));

  const [todayReport] = await db.select().from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.date, today)));

  const missingReports = await db.select().from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.status, "missing")));

  const recentReports = await db.select().from(dailyReportsTable)
    .where(eq(dailyReportsTable.userId, userId))
    .orderBy(sql`${dailyReportsTable.date} DESC`)
    .limit(10);

  const adminNotes = recentReports
    .filter(r => r.adminNote != null && r.adminNote.length > 0)
    .map(r => r.adminNote as string);

  const [wallet] = await db.select().from(walletAddressesTable).where(eq(walletAddressesTable.userId, userId));

  res.json({
    name: user.name,
    personnelNo: user.personnelNo ?? null,
    instagramAccounts: accountsWithCount,
    todayStatus: todayReport?.status ?? null,
    missingDaysCount: missingReports.length,
    adminNotes,
    walletAddress: wallet?.walletAddress ?? null,
    walletStatus: wallet?.status ?? null,
  });
});

router.get("/dashboard/daily-activity", requireAdmin, async (req, res): Promise<void> => {
  const rawPeriod = req.query.period as string;
  const period: Period = ["daily", "weekly", "monthly", "alltime"].includes(rawPeriod)
    ? (rawPeriod as Period)
    : "daily";

  // Geriye dönük bakış için gün sayısı (minimum 1)
  const rawDays = req.query.days ? parseInt(req.query.days as string, 10) : null;
  const days = rawDays && rawDays > 0 ? rawDays : getPeriodDays(period);

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  fromDate.setHours(0, 0, 0, 0);
  const fromDateStr = fromDate.toISOString().split("T")[0]!;

  // Single aggregation query: report counts grouped by date + status
  const reportRows = await db
    .select({
      date: dailyReportsTable.date,
      status: dailyReportsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dailyReportsTable)
    .where(gte(dailyReportsTable.date, fromDateStr))
    .groupBy(dailyReportsTable.date, dailyReportsTable.status);

  // Single aggregation query: reels counts grouped by content_date
  const reelsRows = await db
    .select({
      date: reportItemsTable.contentDate,
      count: sql<number>`count(*)::int`,
    })
    .from(reportItemsTable)
    .where(gte(reportItemsTable.contentDate, fromDateStr))
    .groupBy(reportItemsTable.contentDate);

  // Build lookup maps
  const reportMap: Record<string, Record<string, number>> = {};
  for (const row of reportRows) {
    if (!reportMap[row.date]) reportMap[row.date] = {};
    reportMap[row.date]![row.status] = row.count;
  }
  const reelsMap: Record<string, number> = {};
  for (const row of reelsRows) {
    reelsMap[row.date] = row.count;
  }

  // Build results array over the requested date range
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const statuses = reportMap[dateStr] ?? {};
    const submitted = (statuses["submitted"] ?? 0) + (statuses["approved"] ?? 0) + (statuses["late"] ?? 0);
    const missing = statuses["missing"] ?? 0;
    results.push({
      date: dateStr,
      submitted,
      missing,
      reelsCount: reelsMap[dateStr] ?? 0,
    });
  }

  res.json(results);
});

export default router;
