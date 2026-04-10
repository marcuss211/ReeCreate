import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, instagramAccountsTable, dailyReportsTable, delayFlagsTable, walletAddressesTable } from "@workspace/db";
import { eq, like, or, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
  ResetUserPasswordBody,
  ResetUserPasswordParams,
  ListUsersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  let query = db.select().from(usersTable).$dynamic();

  if (params.success && params.data.status) {
    query = query.where(eq(usersTable.status, params.data.status));
  }
  if (params.success && params.data.search) {
    const s = `%${params.data.search}%`;
    query = query.where(
      or(
        like(usersTable.name, s),
        like(usersTable.username, s),
      )
    );
  }

  const users = await query.orderBy(usersTable.createdAt);
  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    status: u.status,
    personnelNo: u.personnelNo,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  })));
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, username, password, role, personnelNo } = parsed.data;

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  if (personnelNo != null) {
    const [existingNo] = await db.select().from(usersTable).where(eq(usersTable.personnelNo, personnelNo));
    if (existingNo) {
      res.status(400).json({ error: "Personnel number already in use" });
      return;
    }
    if (personnelNo < 300 || personnelNo > 2000) {
      res.status(400).json({ error: "Personnel number must be between 300 and 2000" });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name,
    username,
    passwordHash,
    role: role || "user",
    status: "active",
    personnelNo: personnelNo ?? null,
  }).returning();

  await createAuditLog({
    userId: req.user?.id,
    actionType: "create_user",
    targetType: "user",
    targetId: user.id,
    newValue: JSON.stringify({ name, username, role }),
    req,
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
    personnelNo: user.personnelNo,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user?.role !== "admin" && req.user?.id !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.userId, id));

  const behaviorRows = await db.select().from(delayFlagsTable).where(eq(delayFlagsTable.userId, id));
  const bulkFlags = behaviorRows.filter(r => r.isBulkEntryFlag === 1).length;
  const repeatIssues = behaviorRows.filter(r => r.isRepeatIssue === 1).length;
  const maxDelay = behaviorRows.reduce((max, r) => Math.max(max, r.delayDayCount), 0);

  let behavior = "normal";
  if (bulkFlags > 0) behavior = "bulk entry suspected";
  else if (maxDelay >= 2) behavior = "2+ days delayed";
  else if (repeatIssues >= 3) behavior = "often delayed";
  if (bulkFlags > 0 && maxDelay >= 2) behavior = "needs attention";

  const [wallet] = await db.select().from(walletAddressesTable).where(eq(walletAddressesTable.userId, id));

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
    personnelNo: user.personnelNo,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    instagramAccounts: accounts,
    behaviorSummary: behavior,
    walletAddress: wallet?.walletAddress ?? null,
  });
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const paramsResult = UpdateUserParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id } = paramsResult.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.username != null) updateData.username = parsed.data.username;
  if (parsed.data.role != null) updateData.role = parsed.data.role;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if ("personnelNo" in parsed.data) {
    const pNo = parsed.data.personnelNo;
    if (pNo != null && (pNo < 300 || pNo > 2000)) {
      res.status(400).json({ error: "Personnel number must be between 300 and 2000" });
      return;
    }
    updateData.personnelNo = pNo ?? null;
  }

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();

  await createAuditLog({
    userId: req.user?.id,
    actionType: "update_user",
    targetType: "user",
    targetId: id,
    oldValue: JSON.stringify({ name: existing.name, status: existing.status }),
    newValue: JSON.stringify(updateData),
    req,
  });

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
    personnelNo: user.personnelNo,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

router.post("/users/:id/reset-password", requireAdmin, async (req, res): Promise<void> => {
  const paramsResult = ResetUserPasswordParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long" });
    return;
  }

  const { id } = paramsResult.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));

  await createAuditLog({
    userId: req.user?.id,
    actionType: "reset_password",
    targetType: "user",
    targetId: id,
    req,
  });

  res.json({ message: "Password reset successfully" });
});

export default router;
