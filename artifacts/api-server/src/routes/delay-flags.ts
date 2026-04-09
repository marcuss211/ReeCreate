import { Router, type IRouter } from "express";
import { db, delayFlagsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  ListDelayFlagsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/delay-flags", requireAdmin, async (req, res): Promise<void> => {
  const params = ListDelayFlagsQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: delayFlagsTable.id,
      userId: delayFlagsTable.userId,
      reportId: delayFlagsTable.reportId,
      delayDayCount: delayFlagsTable.delayDayCount,
      isRepeatIssue: delayFlagsTable.isRepeatIssue,
      isBulkEntryFlag: delayFlagsTable.isBulkEntryFlag,
      createdAt: delayFlagsTable.createdAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(delayFlagsTable)
    .leftJoin(usersTable, eq(delayFlagsTable.userId, usersTable.id))
    .$dynamic();

  if (params.success && params.data.userId != null) {
    baseQuery = baseQuery.where(eq(delayFlagsTable.userId, params.data.userId));
  }

  if (params.success && params.data.isBulkEntryFlag === "true") {
    baseQuery = baseQuery.where(eq(delayFlagsTable.isBulkEntryFlag, 1));
  }

  const flags = await baseQuery.orderBy(delayFlagsTable.createdAt);
  res.json(flags);
});

router.get("/delay-flags/behavior-summary", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      personnelNo: usersTable.personnelNo,
      status: usersTable.status,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "user"));

  const summaries = await Promise.all(users.map(async (user) => {
    const flags = await db
      .select()
      .from(delayFlagsTable)
      .where(eq(delayFlagsTable.userId, user.id));

    const totalDelayFlags = flags.length;
    const maxDelayDays = flags.reduce((max, f) => Math.max(max, f.delayDayCount), 0);
    const bulkEntryFlags = flags.filter(f => f.isBulkEntryFlag === 1).length;
    const repeatIssues = flags.filter(f => f.isRepeatIssue === 1).length;

    let behavior = "normal";
    if (bulkEntryFlags > 0 && maxDelayDays >= 3) behavior = "needs attention";
    else if (bulkEntryFlags > 0) behavior = "bulk entry suspected";
    else if (maxDelayDays >= 2) behavior = "2+ days delayed";
    else if (repeatIssues >= 2 || totalDelayFlags >= 5) behavior = "often delayed";

    return {
      userId: user.id,
      userName: user.name,
      userPersonnelNo: user.personnelNo,
      behavior,
      totalDelayFlags,
      maxDelayDays,
      bulkEntryFlags,
      repeatIssues,
    };
  }));

  res.json(summaries);
});

export default router;
