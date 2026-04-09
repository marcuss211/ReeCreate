import { Router, type IRouter } from "express";
import { db, walletAddressesTable, walletAddressLogsTable, usersTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import {
  SetWalletAddressBody,
  ListWalletAddressesQueryParams,
  ListWalletLogsQueryParams,
} from "@workspace/api-zod";

const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const router: IRouter = Router();

router.get("/wallet-addresses", requireAuth, async (req, res): Promise<void> => {
  const params = ListWalletAddressesQueryParams.safeParse(req.query);

  const baseQuery = db
    .select({
      id: walletAddressesTable.id,
      userId: walletAddressesTable.userId,
      network: walletAddressesTable.network,
      walletAddress: walletAddressesTable.walletAddress,
      status: walletAddressesTable.status,
      createdAt: walletAddressesTable.createdAt,
      updatedAt: walletAddressesTable.updatedAt,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(walletAddressesTable)
    .leftJoin(usersTable, eq(walletAddressesTable.userId, usersTable.id));

  if (req.user?.role !== "admin") {
    const wallets = await baseQuery.where(eq(walletAddressesTable.userId, req.user!.id));
    res.json(wallets);
    return;
  }

  if (params.success && params.data.userId != null) {
    const wallets = await baseQuery.where(eq(walletAddressesTable.userId, params.data.userId));
    res.json(wallets);
    return;
  }

  const wallets = await baseQuery.orderBy(walletAddressesTable.updatedAt);
  res.json(wallets);
});

router.post("/wallet-addresses", requireAuth, async (req, res): Promise<void> => {
  const parsed = SetWalletAddressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { walletAddress, note } = parsed.data;

  if (!TRC20_REGEX.test(walletAddress)) {
    res.status(400).json({ error: "Invalid TRC20 address. Must start with T and be exactly 34 characters." });
    return;
  }

  const userId = req.user!.id;
  const [existing] = await db.select().from(walletAddressesTable).where(eq(walletAddressesTable.userId, userId));

  const oldAddress = existing?.walletAddress ?? null;

  if (existing) {
    if (existing.walletAddress === walletAddress) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      res.json({ ...existing, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null });
      return;
    }

    await db.update(walletAddressesTable).set({
      walletAddress,
      status: "active",
    }).where(eq(walletAddressesTable.userId, userId));
  } else {
    await db.insert(walletAddressesTable).values({
      userId,
      network: "TRC20",
      walletAddress,
      status: "active",
    });
  }

  await db.insert(walletAddressLogsTable).values({
    userId,
    oldWalletAddress: oldAddress,
    newWalletAddress: walletAddress,
    changedBy: req.user?.id ?? null,
    note: note ?? null,
  });

  await createAuditLog({
    userId,
    actionType: "update_wallet_address",
    targetType: "wallet_address",
    oldValue: oldAddress,
    newValue: walletAddress,
    req,
  });

  const [wallet] = await db.select().from(walletAddressesTable).where(eq(walletAddressesTable.userId, userId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.json({ ...wallet, userName: user?.name ?? null, userPersonnelNo: user?.personnelNo ?? null });
});

router.get("/wallet-addresses/logs", requireAuth, async (req, res): Promise<void> => {
  const params = ListWalletLogsQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: walletAddressLogsTable.id,
      userId: walletAddressLogsTable.userId,
      oldWalletAddress: walletAddressLogsTable.oldWalletAddress,
      newWalletAddress: walletAddressLogsTable.newWalletAddress,
      changedAt: walletAddressLogsTable.changedAt,
      changedBy: walletAddressLogsTable.changedBy,
      note: walletAddressLogsTable.note,
      userName: usersTable.name,
      userPersonnelNo: usersTable.personnelNo,
    })
    .from(walletAddressLogsTable)
    .leftJoin(usersTable, eq(walletAddressLogsTable.userId, usersTable.id))
    .$dynamic();

  if (req.user?.role !== "admin") {
    baseQuery = baseQuery.where(eq(walletAddressLogsTable.userId, req.user!.id));
  } else if (params.success && params.data.userId != null) {
    baseQuery = baseQuery.where(eq(walletAddressLogsTable.userId, params.data.userId));
  }

  if (params.success && params.data.since) {
    baseQuery = baseQuery.where(gte(walletAddressLogsTable.changedAt, new Date(params.data.since)));
  }

  const logs = await baseQuery.orderBy(walletAddressLogsTable.changedAt);
  res.json(logs);
});

export default router;
