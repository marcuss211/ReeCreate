import { Router, type IRouter } from "express";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  requirePreAuth,
  PRE_AUTH_COOKIE_NAME,
  PRE_AUTH_CLEAR_OPTIONS,
} from "../middlewares/preauth";
import { signToken, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import { twoFactorRateLimit } from "../middlewares/rate-limit";

const APP_NAME = "Reels Panel";

const router: IRouter = Router();

router.post("/auth/2fa/setup", requirePreAuth, async (req, res): Promise<void> => {
  const preUser = req.preAuthUser!;

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, preUser.id));
  if (!dbUser || dbUser.role !== "admin") {
    res.status(403).json({ error: "2FA setup is only available for admin users" });
    return;
  }

  const secret = speakeasy.generateSecret({
    name: `${APP_NAME}:${preUser.username}`,
    issuer: APP_NAME,
    length: 32,
  });

  await db.update(usersTable)
    .set({ twoFactorSecret: secret.base32 })
    .where(eq(usersTable.id, preUser.id));

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

  await createAuditLog({
    userId: preUser.id,
    actionType: "2fa_setup_started",
    req,
  });

  res.json({
    qrCodeDataUrl: qrDataUrl,
    manualKey: secret.base32,
  });
});

router.post("/auth/2fa/verify-setup", requirePreAuth, twoFactorRateLimit, async (req, res): Promise<void> => {
  const preUser = req.preAuthUser!;
  const code = typeof req.body?.code === "string" ? req.body.code.replace(/\s/g, "") : "";

  if (!code) {
    res.status(400).json({ error: "6-digit TOTP code is required" });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, preUser.id));

  if (!dbUser || !dbUser.twoFactorSecret) {
    res.status(400).json({ error: "2FA setup not initiated. Please restart setup." });
    return;
  }

  const valid = speakeasy.totp.verify({
    secret: dbUser.twoFactorSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!valid) {
    await createAuditLog({
      userId: preUser.id,
      actionType: "2fa_verify_failed",
      newValue: JSON.stringify({ phase: "setup" }),
      req,
    });
    res.status(400).json({ error: "Invalid or expired code. Please try again." });
    return;
  }

  await db.update(usersTable).set({
    twoFactorEnabled: true,
    twoFactorSetupCompletedAt: new Date(),
    twoFactorLastVerifiedAt: new Date(),
  }).where(eq(usersTable.id, preUser.id));

  await createAuditLog({
    userId: preUser.id,
    actionType: "2fa_setup_completed",
    req,
  });
  await createAuditLog({
    userId: preUser.id,
    actionType: "2fa_verify_success",
    newValue: JSON.stringify({ phase: "setup" }),
    req,
  });

  const token = signToken({
    id: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
    name: dbUser.name,
  });

  res.clearCookie(PRE_AUTH_COOKIE_NAME, PRE_AUTH_CLEAR_OPTIONS);
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  res.json({
    user: {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role,
      status: dbUser.status,
      personnelNo: dbUser.personnelNo,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    },
  });
});

router.post("/auth/2fa/verify", requirePreAuth, twoFactorRateLimit, async (req, res): Promise<void> => {
  const preUser = req.preAuthUser!;
  const code = typeof req.body?.code === "string" ? req.body.code.replace(/\s/g, "") : "";

  if (!code) {
    res.status(400).json({ error: "6-digit TOTP code is required" });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, preUser.id));

  if (!dbUser || !dbUser.twoFactorEnabled || !dbUser.twoFactorSecret) {
    res.status(400).json({ error: "2FA is not configured for this account" });
    return;
  }

  const valid = speakeasy.totp.verify({
    secret: dbUser.twoFactorSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!valid) {
    await createAuditLog({
      userId: preUser.id,
      actionType: "2fa_verify_failed",
      newValue: JSON.stringify({ phase: "login" }),
      req,
    });
    res.status(400).json({ error: "Invalid or expired code. Please try again." });
    return;
  }

  await db.update(usersTable)
    .set({ twoFactorLastVerifiedAt: new Date() })
    .where(eq(usersTable.id, preUser.id));

  await createAuditLog({
    userId: preUser.id,
    actionType: "2fa_verify_success",
    newValue: JSON.stringify({ phase: "login" }),
    req,
  });

  const token = signToken({
    id: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
    name: dbUser.name,
  });

  res.clearCookie(PRE_AUTH_COOKIE_NAME, PRE_AUTH_CLEAR_OPTIONS);
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  res.json({
    user: {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role,
      status: dbUser.status,
      personnelNo: dbUser.personnelNo,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    },
  });
});

export default router;
