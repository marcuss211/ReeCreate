import { Router, type IRouter } from "express";
import { db, instagramAccountsTable, usersTable, reportItemsTable } from "@workspace/db";
import { eq, like, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import {
  CreateInstagramAccountBody,
  UpdateInstagramAccountBody,
  GetInstagramAccountParams,
  UpdateInstagramAccountParams,
  ListInstagramAccountsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/instagram-accounts", requireAuth, async (req, res): Promise<void> => {
  const params = ListInstagramAccountsQueryParams.safeParse(req.query);

  let conditions: ReturnType<typeof eq>[] = [];

  if (req.user?.role !== "admin") {
    conditions.push(eq(instagramAccountsTable.userId, req.user!.id));
  } else if (params.success && params.data.userId != null) {
    conditions.push(eq(instagramAccountsTable.userId, params.data.userId));
  }

  if (params.success && params.data.status) {
    conditions.push(eq(instagramAccountsTable.status, params.data.status));
  }

  const baseQuery = db
    .select({
      id: instagramAccountsTable.id,
      userId: instagramAccountsTable.userId,
      instagramUsername: instagramAccountsTable.instagramUsername,
      profileUrl: instagramAccountsTable.profileUrl,
      description: instagramAccountsTable.description,
      status: instagramAccountsTable.status,
      createdAt: instagramAccountsTable.createdAt,
      updatedAt: instagramAccountsTable.updatedAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(instagramAccountsTable)
    .leftJoin(usersTable, eq(instagramAccountsTable.userId, usersTable.id));

  const accounts = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(instagramAccountsTable.instagramUsername)
    : await baseQuery.orderBy(instagramAccountsTable.instagramUsername);

  if (params.success && params.data.search) {
    const s = params.data.search.toLowerCase();
    const filtered = accounts.filter(a =>
      a.instagramUsername.toLowerCase().includes(s) ||
      (a.userName?.toLowerCase().includes(s) ?? false)
    );
    res.json(filtered);
    return;
  }

  res.json(accounts);
});

router.post("/instagram-accounts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateInstagramAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) {
    res.status(400).json({ error: "Kullanıcı bulunamadı" });
    return;
  }

  const [account] = await db.insert(instagramAccountsTable).values({
    userId: parsed.data.userId,
    instagramUsername: parsed.data.instagramUsername,
    profileUrl: parsed.data.profileUrl ?? null,
    description: parsed.data.description ?? null,
    status: "active",
  }).returning();

  await createAuditLog({
    userId: req.user?.id,
    actionType: "create_instagram_account",
    targetType: "instagram_account",
    targetId: account.id,
    newValue: JSON.stringify({ instagramUsername: account.instagramUsername, userId: account.userId }),
    req,
  });

  res.status(201).json({ ...account, userName: user.name, userPersonnelNo: user.personnelNo });
});

router.get("/instagram-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db
    .select({
      id: instagramAccountsTable.id,
      userId: instagramAccountsTable.userId,
      instagramUsername: instagramAccountsTable.instagramUsername,
      profileUrl: instagramAccountsTable.profileUrl,
      description: instagramAccountsTable.description,
      status: instagramAccountsTable.status,
      createdAt: instagramAccountsTable.createdAt,
      updatedAt: instagramAccountsTable.updatedAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(instagramAccountsTable)
    .leftJoin(usersTable, eq(instagramAccountsTable.userId, usersTable.id))
    .where(eq(instagramAccountsTable.id, id));

  if (!result) {
    res.status(404).json({ error: "Hesap bulunamadı" });
    return;
  }

  if (req.user?.role !== "admin" && result.userId !== req.user?.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(result);
});

router.patch("/instagram-accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const paramsResult = UpdateInstagramAccountParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateInstagramAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id } = paramsResult.data;
  const [existing] = await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Hesap bulunamadı" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.instagramUsername != null) updateData.instagramUsername = parsed.data.instagramUsername;
  if ("profileUrl" in parsed.data) updateData.profileUrl = parsed.data.profileUrl ?? null;
  if ("description" in parsed.data) updateData.description = parsed.data.description ?? null;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if ("userId" in parsed.data && parsed.data.userId != null) updateData.userId = parsed.data.userId;

  const [account] = await db.update(instagramAccountsTable).set(updateData).where(eq(instagramAccountsTable.id, id)).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, account.userId));

  await createAuditLog({
    userId: req.user?.id,
    actionType: "update_instagram_account",
    targetType: "instagram_account",
    targetId: id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify(updateData),
    req,
  });

  res.json({ ...account, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null });
});

router.delete("/instagram-accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const [existing] = await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Hesap bulunamadı" });
    return;
  }

  const [itemCheck] = await db.select().from(reportItemsTable).where(eq(reportItemsTable.instagramAccountId, id));
  if (itemCheck) {
    res.status(400).json({ error: "Bu hesaba ait reel kayıtları bulunduğu için silinemez" });
    return;
  }

  await createAuditLog({
    userId: req.user?.id,
    actionType: "delete_instagram_account",
    targetType: "instagram_account",
    targetId: id,
    oldValue: JSON.stringify({ instagramUsername: existing.instagramUsername }),
    req,
  });

  await db.delete(instagramAccountsTable).where(eq(instagramAccountsTable.id, id));
  res.status(204).send();
});

export default router;
