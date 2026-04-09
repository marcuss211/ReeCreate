import { db, auditLogsTable } from "@workspace/db";
import { Request } from "express";

interface AuditParams {
  userId?: number | null;
  actionType: string;
  targetType?: string | null;
  targetId?: number | null;
  oldValue?: string | null;
  newValue?: string | null;
  req?: Request;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: params.userId ?? null,
    actionType: params.actionType,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    ipAddress: params.req?.ip ?? null,
    userAgent: params.req?.headers["user-agent"] ?? null,
  });
}
