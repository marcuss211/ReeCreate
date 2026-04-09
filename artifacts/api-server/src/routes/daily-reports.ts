import { Router, type IRouter } from "express";
import { db, dailyReportsTable, reportItemsTable, instagramAccountsTable, usersTable, delayFlagsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import {
  CreateDailyReportBody,
  UpdateDailyReportBody,
  GetDailyReportParams,
  UpdateDailyReportParams,
  ListDailyReportsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function daysBetween(dateStr: string, now: Date): number {
  const reportDate = new Date(dateStr);
  const diffMs = now.getTime() - reportDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

router.get("/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const params = ListDailyReportsQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: dailyReportsTable.id,
      userId: dailyReportsTable.userId,
      date: dailyReportsTable.date,
      status: dailyReportsTable.status,
      adminNote: dailyReportsTable.adminNote,
      submittedAt: dailyReportsTable.submittedAt,
      approvedAt: dailyReportsTable.approvedAt,
      createdAt: dailyReportsTable.createdAt,
      updatedAt: dailyReportsTable.updatedAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(dailyReportsTable)
    .leftJoin(usersTable, eq(dailyReportsTable.userId, usersTable.id))
    .$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];

  if (req.user?.role !== "admin") {
    conditions.push(eq(dailyReportsTable.userId, req.user!.id));
  } else if (params.success && params.data.userId != null) {
    conditions.push(eq(dailyReportsTable.userId, params.data.userId));
  }

  if (params.success && params.data.date) {
    conditions.push(eq(dailyReportsTable.date, params.data.date));
  }

  if (params.success && params.data.status) {
    conditions.push(eq(dailyReportsTable.status, params.data.status));
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  const reports = await baseQuery.orderBy(dailyReportsTable.date);

  const reportIds = reports.map(r => r.id);
  let itemCounts: Record<number, number> = {};
  if (reportIds.length > 0) {
    const counts = await Promise.all(
      reportIds.map(async (rid) => {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reportItemsTable)
          .where(eq(reportItemsTable.reportId, rid));
        return { id: rid, count: row?.count ?? 0 };
      })
    );
    itemCounts = Object.fromEntries(counts.map(c => [c.id, c.count]));
  }

  res.json(reports.map(r => ({ ...r, itemCount: itemCounts[r.id] ?? 0 })));
});

router.post("/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDailyReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = (req.user?.role === "admin" && parsed.data.userId != null)
    ? parsed.data.userId
    : req.user!.id;

  const [existing] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.date, parsed.data.date)));

  if (existing) {
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportItemsTable)
      .where(eq(reportItemsTable.reportId, existing.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId));
    res.json({ ...existing, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null, itemCount: count?.count ?? 0 });
    return;
  }

  const [report] = await db.insert(dailyReportsTable).values({
    userId,
    date: parsed.data.date,
    status: "draft",
  }).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  res.json({ ...report, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null, itemCount: 0 });
});

router.get("/daily-reports/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [report] = await db
    .select({
      id: dailyReportsTable.id,
      userId: dailyReportsTable.userId,
      date: dailyReportsTable.date,
      status: dailyReportsTable.status,
      adminNote: dailyReportsTable.adminNote,
      submittedAt: dailyReportsTable.submittedAt,
      approvedAt: dailyReportsTable.approvedAt,
      createdAt: dailyReportsTable.createdAt,
      updatedAt: dailyReportsTable.updatedAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(dailyReportsTable)
    .leftJoin(usersTable, eq(dailyReportsTable.userId, usersTable.id))
    .where(eq(dailyReportsTable.id, id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (req.user?.role !== "admin" && report.userId !== req.user?.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db
    .select({
      id: reportItemsTable.id,
      reportId: reportItemsTable.reportId,
      instagramAccountId: reportItemsTable.instagramAccountId,
      reelsUrl: reportItemsTable.reelsUrl,
      contentDate: reportItemsTable.contentDate,
      enteredAt: reportItemsTable.enteredAt,
      createdAt: reportItemsTable.createdAt,
      instagramUsername: instagramAccountsTable.instagramUsername,
    })
    .from(reportItemsTable)
    .leftJoin(instagramAccountsTable, eq(reportItemsTable.instagramAccountId, instagramAccountsTable.id))
    .where(eq(reportItemsTable.reportId, id));

  res.json({ ...report, items, itemCount: items.length });
});

router.patch("/daily-reports/:id", requireAuth, async (req, res): Promise<void> => {
  const paramsResult = UpdateDailyReportParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateDailyReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id } = paramsResult.data;
  const [existing] = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (req.user?.role !== "admin" && existing.userId !== req.user?.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "submitted") {
      updateData.submittedAt = new Date();

      const now = new Date();
      const delayDays = daysBetween(existing.date, now);

      if (delayDays > 0) {
        const previousFlags = await db
          .select()
          .from(delayFlagsTable)
          .where(eq(delayFlagsTable.userId, existing.userId));

        const isRepeat = previousFlags.filter(f => f.delayDayCount > 0).length >= 3 ? 1 : 0;
        const isBulk = delayDays > 5 ? 1 : 0;

        await db.insert(delayFlagsTable).values({
          userId: existing.userId,
          reportId: id,
          delayDayCount: delayDays,
          isRepeatIssue: isRepeat,
          isBulkEntryFlag: isBulk,
        });

        if (delayDays > 2) {
          updateData.status = "late";
        }
      }
    }
    if (parsed.data.status === "approved") {
      updateData.approvedAt = new Date();
    }
  }

  if ("adminNote" in parsed.data) {
    updateData.adminNote = parsed.data.adminNote ?? null;
  }

  const [report] = await db.update(dailyReportsTable).set(updateData).where(eq(dailyReportsTable.id, id)).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.userId));

  await createAuditLog({
    userId: req.user?.id,
    actionType: "update_daily_report",
    targetType: "daily_report",
    targetId: id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify(updateData),
    req,
  });

  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reportItemsTable)
    .where(eq(reportItemsTable.reportId, id));

  res.json({ ...report, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null, itemCount: count?.count ?? 0 });
});

export default router;
