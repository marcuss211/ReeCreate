import { Router, type IRouter } from "express";
import { db, usersTable, dailyReportsTable, reportItemsTable, instagramAccountsTable, paymentAgreementsTable, auditLogsTable, walletAddressLogsTable, delayFlagsTable } from "@workspace/db";
import { eq, sql, gte, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

type Period = "daily" | "weekly" | "monthly" | "alltime";

function getFromDateStr(period: Period): string | null {
  const now = new Date();
  if (period === "daily") return now.toISOString().split("T")[0];
  if (period === "weekly") { const d = new Date(now); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; }
  if (period === "monthly") { const d = new Date(now); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; }
  return null;
}

function getFromTimestamp(period: Period): Date | null {
  const now = new Date();
  if (period === "daily") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (period === "weekly") { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  if (period === "monthly") { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function getPeriodDays(period: Period): number {
  if (period === "daily") return 1;
  if (period === "weekly") return 7;
  if (period === "monthly") return 30;
  return 90;
}

// ─── /api/reports/summary ───────────────────────────────────────────────────
router.get("/reports/summary", requireAdmin, async (req, res): Promise<void> => {
  const rawPeriod = req.query.period as string;
  const period: Period = ["daily", "weekly", "monthly", "alltime"].includes(rawPeriod) ? (rawPeriod as Period) : "alltime";
  const fromDateStr = getFromDateStr(period);
  const fromTs = getFromTimestamp(period);

  // ── Kullanıcı istatistikleri (anlık snapshot) ──
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, "user"));
  const [activeUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "user"), eq(usersTable.status, "active")));

  // ── Dönem bazlı rapor istatistikleri ──
  const reports = fromDateStr
    ? await db.select().from(dailyReportsTable).where(gte(dailyReportsTable.date, fromDateStr))
    : await db.select().from(dailyReportsTable);

  const approvedReportIds = reports.filter(r => r.status === "approved").map(r => r.id);
  const pendingReportIds  = reports.filter(r => r.status === "submitted").map(r => r.id);

  // Toplam reels sayısı (report_items.content_date ile)
  const reelsWhere = fromDateStr
    ? gte(reportItemsTable.contentDate, fromDateStr)
    : undefined;
  const [totalReelsRow] = reelsWhere
    ? await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(reelsWhere)
    : await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable);

  // Onaylı reels sayısı
  let approvedReels = 0;
  if (approvedReportIds.length > 0) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(inArray(reportItemsTable.reportId, approvedReportIds));
    approvedReels = r?.count ?? 0;
  }

  // Onay bekleyen reels
  let pendingReels = 0;
  if (pendingReportIds.length > 0) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(inArray(reportItemsTable.reportId, pendingReportIds));
    pendingReels = r?.count ?? 0;
  }

  // Reddedilen reels
  const rejectedReportIds = reports.filter(r => r.status === "rejected").map(r => r.id);
  let rejectedReels = 0;
  if (rejectedReportIds.length > 0) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(inArray(reportItemsTable.reportId, rejectedReportIds));
    rejectedReels = r?.count ?? 0;
  }

  // Eksik gönderim yapan kullanıcılar (distinct user_id with missing status in period)
  const missingUserIds = new Set(reports.filter(r => r.status === "missing").map(r => r.userId));

  // Gecikmeli kullanıcılar
  const delayedFlagsQ = fromTs
    ? db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable).where(and(sql`${delayFlagsTable.delayDayCount} > 2`, gte(delayFlagsTable.createdAt, fromTs)))
    : db.select({ userId: delayFlagsTable.userId }).from(delayFlagsTable).where(sql`${delayFlagsTable.delayDayCount} > 2`);
  const delayedFlags = await delayedFlagsQ;
  const delayedUsers = new Set(delayedFlags.map(f => f.userId)).size;

  // ── Ödeme istatistikleri (tüm zamanlar) ──
  const agreements = await db.select().from(paymentAgreementsTable);
  const totalAgreements = agreements.length;
  const totalAgreementAmount = agreements.reduce((s, a) => s + parseFloat(a.totalAmount ?? "0"), 0);
  const totalPaid = agreements.reduce((s, a) => s + parseFloat(a.paidAmount ?? "0"), 0);
  const totalRemaining = Math.max(0, totalAgreementAmount - totalPaid);
  const fullyPaidAgreements   = agreements.filter(a => parseFloat(a.paidAmount ?? "0") >= parseFloat(a.totalAmount ?? "0") && parseFloat(a.totalAmount ?? "0") > 0).length;
  const partialPaidAgreements = agreements.filter(a => { const p = parseFloat(a.paidAmount ?? "0"); const t = parseFloat(a.totalAmount ?? "0"); return p > 0 && p < t; }).length;
  const unpaidAgreements      = agreements.filter(a => parseFloat(a.paidAmount ?? "0") <= 0).length;

  res.json({
    period,
    // Kullanıcı
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    // Reels
    totalReels: totalReelsRow?.count ?? 0,
    approvedReels,
    pendingReels,
    rejectedReels,
    // Eksik / Gecikmeli
    missingSubmissionUsers: missingUserIds.size,
    delayedUsers,
    // Ödeme
    totalAgreements,
    totalAgreementAmount,
    totalPaid,
    totalRemaining,
    fullyPaidAgreements,
    partialPaidAgreements,
    unpaidAgreements,
  });
});

// ─── /api/reports/user-performance ─────────────────────────────────────────
router.get("/reports/user-performance", requireAdmin, async (req, res): Promise<void> => {
  const rawPeriod = req.query.period as string;
  const period: Period = ["daily", "weekly", "monthly", "alltime"].includes(rawPeriod) ? (rawPeriod as Period) : "alltime";
  const fromDateStr = getFromDateStr(period);

  const users = await db.select().from(usersTable).where(eq(usersTable.role, "user"));
  const accounts = await db.select().from(instagramAccountsTable);

  const reports = fromDateStr
    ? await db.select().from(dailyReportsTable).where(gte(dailyReportsTable.date, fromDateStr))
    : await db.select().from(dailyReportsTable);

  // Report items için onaylı report id'leri al
  const approvedIds = reports.filter(r => r.status === "approved").map(r => r.id);
  let approvedItemsByReport: Record<number, number> = {};
  if (approvedIds.length > 0) {
    const rows = await db.select({ reportId: reportItemsTable.reportId, count: sql<number>`count(*)::int` })
      .from(reportItemsTable)
      .where(inArray(reportItemsTable.reportId, approvedIds))
      .groupBy(reportItemsTable.reportId);
    for (const r of rows) approvedItemsByReport[r.reportId] = r.count;
  }

  const performance = users.map(u => {
    const userReports = reports.filter(r => r.userId === u.id);
    const userAccounts = accounts.filter(a => a.userId === u.id);

    const approved = userReports.filter(r => r.status === "approved");
    const rejected = userReports.filter(r => r.status === "rejected");
    const missing  = userReports.filter(r => r.status === "missing");
    const delayed  = userReports.filter(r => r.status === "late");

    const approvedReelsTotal = approved.reduce((s, r) => s + (approvedItemsByReport[r.id] ?? 0), 0);
    const totalDays = userReports.length;
    const lastActivity = userReports.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;

    const approvalRate = approved.length > 0 && totalDays > 0
      ? Math.round((approved.length / (totalDays - missing.length || 1)) * 100)
      : 0;

    const periodDays = getPeriodDays(period);
    const avgDailyReels = periodDays > 0 && approvedReelsTotal > 0
      ? Math.round((approvedReelsTotal / periodDays) * 10) / 10
      : 0;

    return {
      id: u.id,
      name: u.name,
      username: u.username,
      status: u.status,
      totalAccounts: userAccounts.length,
      totalReports: totalDays,
      approvedReports: approved.length,
      rejectedReports: rejected.length,
      missingDays: missing.length,
      delayCount: delayed.length,
      approvedReels: approvedReelsTotal,
      avgDailyReels,
      approvalRate,
      lastActivity,
    };
  });

  // Onaylı rapor sayısına göre sırala
  performance.sort((a, b) => b.approvedReports - a.approvedReports);

  res.json(performance);
});

// ─── /api/reports/timeline ──────────────────────────────────────────────────
router.get("/reports/timeline", requireAdmin, async (req, res): Promise<void> => {
  const rawPeriod = req.query.period as string;
  const period: Period = ["daily", "weekly", "monthly", "alltime"].includes(rawPeriod) ? (rawPeriod as Period) : "alltime";
  const days = getPeriodDays(period);
  const results = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const dayReports = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.date, dateStr));
    const approved = dayReports.filter(r => r.status === "approved").length;
    const pending  = dayReports.filter(r => r.status === "submitted").length;
    const rejected = dayReports.filter(r => r.status === "rejected").length;
    const missing  = dayReports.filter(r => r.status === "missing").length;

    const [reelsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(reportItemsTable).where(eq(reportItemsTable.contentDate, dateStr));

    results.push({ date: dateStr, approved, pending, rejected, missing, reels: reelsRow?.count ?? 0 });
  }

  res.json(results);
});

// ─── /api/reports/payment-details ───────────────────────────────────────────
router.get("/reports/payment-details", requireAdmin, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const rows = await db.select().from(paymentAgreementsTable).orderBy(paymentAgreementsTable.endDate);

  const result = rows.map(a => {
    const total = parseFloat(a.totalAmount ?? "0");
    const paid  = parseFloat(a.paidAmount  ?? "0");
    const remaining = Math.max(0, total - paid);
    let paymentStatus: "Ödenmedi" | "Kısmi Ödendi" | "Tam Ödendi" = "Ödenmedi";
    if (paid >= total && total > 0) paymentStatus = "Tam Ödendi";
    else if (paid > 0) paymentStatus = "Kısmi Ödendi";
    const isExpired  = a.endDate < today;
    const isExpiring = !isExpired && a.endDate <= nextWeekStr;
    return { ...a, totalAmount: total, paidAmount: paid, remaining, paymentStatus, isExpired, isExpiring };
  });

  res.json(result);
});

// ─── /api/reports/audit-events ──────────────────────────────────────────────
router.get("/reports/audit-events", requireAdmin, async (req, res): Promise<void> => {
  const since24h = new Date(); since24h.setHours(since24h.getHours() - 24);

  const recentAudit = await db.select({
    id: auditLogsTable.id,
    actionType: auditLogsTable.actionType,
    targetType: auditLogsTable.targetType,
    targetId: auditLogsTable.targetId,
    createdAt: auditLogsTable.createdAt,
  }).from(auditLogsTable)
    .where(gte(auditLogsTable.createdAt, since24h))
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(20);

  const recentWalletChanges = await db.select({
    id: walletAddressLogsTable.id,
    userId: walletAddressLogsTable.userId,
    changedAt: walletAddressLogsTable.changedAt,
  }).from(walletAddressLogsTable)
    .where(gte(walletAddressLogsTable.changedAt, since24h))
    .orderBy(sql`${walletAddressLogsTable.changedAt} DESC`)
    .limit(10);

  // Toplu giriş şüpheli kullanıcılar (isBulkEntryFlag = 1, son 7 gün)
  const since7d = new Date(); since7d.setDate(since7d.getDate() - 7);
  const bulkFlags = await db.select({
    userId: delayFlagsTable.userId,
    createdAt: delayFlagsTable.createdAt,
  }).from(delayFlagsTable)
    .where(and(eq(delayFlagsTable.isBulkEntryFlag, 1), gte(delayFlagsTable.createdAt, since7d)))
    .orderBy(sql`${delayFlagsTable.createdAt} DESC`)
    .limit(10);

  res.json({
    recentAuditEvents: recentAudit,
    recentWalletChanges,
    bulkFlagEvents: bulkFlags,
  });
});

export default router;
