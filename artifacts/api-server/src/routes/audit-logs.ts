import { Router, type IRouter } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      actionType: auditLogsTable.actionType,
      targetType: auditLogsTable.targetType,
      targetId: auditLogsTable.targetId,
      oldValue: auditLogsTable.oldValue,
      newValue: auditLogsTable.newValue,
      ipAddress: auditLogsTable.ipAddress,
      userAgent: auditLogsTable.userAgent,
      createdAt: auditLogsTable.createdAt,
      userName: usersTable.name,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .$dynamic();

  if (params.success && params.data.userId != null) {
    baseQuery = baseQuery.where(eq(auditLogsTable.userId, params.data.userId));
  }

  if (params.success && params.data.actionType) {
    baseQuery = baseQuery.where(eq(auditLogsTable.actionType, params.data.actionType));
  }

  const limit = (params.success && params.data.limit) ? params.data.limit : 100;

  const logs = await baseQuery.orderBy(sql`${auditLogsTable.createdAt} DESC`).limit(limit);
  res.json(logs);
});

export default router;
