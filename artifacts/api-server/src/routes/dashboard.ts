import { Router, type IRouter } from "express";
import { db, usersTable, dailyReportsTable, reportItemsTable, walletAddressLogsTable, delayFlagsTable, instagramAccountsTable, walletAddressesTable } from "@workspace/db";
import { eq, gte, sql, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { GetDailyActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAdmin, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const yesterday24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, "user"));
  const [activeUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "user"), eq(usersTable.status, "active")));

  const todayReports = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.date, today));
  const submittedToday = todayReports.filter(r => ["submitted", "approved", "late", "bulk_flagged"].includes(r.status)).length;
  const missingToday = todayReports.filter(r => r.status === "missing").length;
  const pendingApprovals = todayReports.filter(r => r.status === "submitted").length;
  const rejectedItems = todayReports.filter(r => r.status === "rejected").length;

  const reportIds = todayReports.map(r => r.id);
  let totalReelsToday = 0;
  if (reportIds.length > 0) {
    const [reelsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportItemsTable)
      .where(eq(reportItemsTable.contentDate, today));
    totalReelsToday = reelsCount?.count ?? 0;
  }

  const [walletChanges] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(walletAddressLogsTable)
    .where(gte(walletAddressLogsTable.changedAt, yesterday24h));

  const delayedFlags = await db
    .select({ userId: delayFlagsTable.userId })
    .from(delayFlagsTable)
    .where(sql`${delayFlagsTable.delayDayCount} > 2`);
  const delayedUsers = new Set(delayedFlags.map(f => f.userId)).size;

  const bulkFlags = await db
    .select({ userId: delayFlagsTable.userId })
    .from(delayFlagsTable)
    .where(eq(delayFlagsTable.isBulkEntryFlag, 1));
  const bulkFlaggedUsers = new Set(bulkFlags.map(f => f.userId)).size;

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    todaySubmittedCount: submittedToday,
    todayMissingCount: missingToday,
    totalReelsTodayCount: totalReelsToday,
    pendingApprovals,
    rejectedItems,
    delayedUsers,
    bulkFlaggedUsers,
    walletChanges24h: walletChanges?.count ?? 0,
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
  const params = GetDailyActivityQueryParams.safeParse(req.query);
  const days = params.success && params.data.days ? params.data.days : 14;

  const results = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const reports = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.date, dateStr));
    const submitted = reports.filter(r => ["submitted", "approved", "late"].includes(r.status)).length;
    const missing = reports.filter(r => r.status === "missing").length;

    const [reelsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportItemsTable)
      .where(eq(reportItemsTable.contentDate, dateStr));

    results.push({
      date: dateStr,
      submitted,
      missing,
      reelsCount: reelsCount?.count ?? 0,
    });
  }

  res.json(results);
});

export default router;
