import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "../middlewares/auth";
import { signPreAuthToken, PRE_AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_OPTIONS } from "../middlewares/preauth";
import { createAuditLog } from "../lib/audit";
import { LoginBody } from "@workspace/api-zod";
import { loginRateLimit } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Pre-computed hash used when the requested user does not exist.
// Calling bcrypt.compare against this dummy hash makes the response time
// indistinguishable from a wrong-password attempt, preventing user enumeration
// via timing differences.
const DUMMY_HASH = "$2a$12$WKPRMHPVvRbNMnEu8yv0j.D0eH5R2NMOWZNQvPVJLk2PgC9rmN5Oq";

interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: Date;
  lockedUntil?: Date;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function getAttemptKey(req: import("express").Request, username: string): string {
  const ip = req.ip ?? "unknown";
  return `${ip}:${username.toLowerCase()}`;
}

function isLocked(record: LoginAttemptRecord): boolean {
  if (!record.lockedUntil) return false;
  return record.lockedUntil > new Date();
}

function recordFailure(key: string): LoginAttemptRecord {
  const now = new Date();
  const existing = loginAttempts.get(key);

  if (
    existing &&
    now.getTime() - existing.firstAttemptAt.getTime() < ATTEMPT_WINDOW_MS
  ) {
    existing.count += 1;
    if (existing.count >= MAX_FAILED_ATTEMPTS) {
      existing.lockedUntil = new Date(now.getTime() + LOCKOUT_MS);
    }
    return existing;
  }

  const record: LoginAttemptRecord = { count: 1, firstAttemptAt: now };
  loginAttempts.set(key, record);
  return record;
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

setInterval(() => {
  const now = new Date();
  for (const [key, record] of loginAttempts.entries()) {
    const expired = now.getTime() - record.firstAttemptAt.getTime() > ATTEMPT_WINDOW_MS * 2;
    const unlocked = record.lockedUntil && record.lockedUntil < now;
    if (expired || unlocked) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, password } = parsed.data;
  const attemptKey = getAttemptKey(req, username);
  const existing = loginAttempts.get(attemptKey);

  if (existing && isLocked(existing)) {
    const remainingMs = existing.lockedUntil!.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    logger.warn({ username, ip: req.ip }, "Login attempt on locked account");
    res.status(429).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  const failResponse = async (reason: string) => {
    const record = recordFailure(attemptKey);
    logger.warn({ username, ip: req.ip, reason, failCount: record.count }, "Failed login attempt");

    await createAuditLog({
      userId: user?.id ?? null,
      actionType: "login_failed",
      targetType: "user",
      newValue: JSON.stringify({ username, reason }),
      req,
    });

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      res.status(429).json({
        error: "Too many failed attempts. Account temporarily locked for 15 minutes.",
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  };

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await failResponse("user_not_found");
    return;
  }

  if (user.status !== "active") {
    await bcrypt.compare(password, DUMMY_HASH);
    await failResponse("account_inactive");
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await failResponse("wrong_password");
    return;
  }

  clearAttempts(attemptKey);

  // Admin users must complete 2FA before receiving a full session cookie
  if (user.role === "admin") {
    const preAuthToken = signPreAuthToken({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });

    res.cookie(PRE_AUTH_COOKIE_NAME, preAuthToken, PRE_AUTH_COOKIE_OPTIONS);

    await createAuditLog({
      userId: user.id,
      actionType: "login_password_ok",
      newValue: JSON.stringify({ twoFactorEnabled: user.twoFactorEnabled }),
      req,
    });

    if (!user.twoFactorEnabled) {
      res.json({ status: "2fa_setup_required" });
    } else {
      res.json({ status: "2fa_required" });
    }
    return;
  }

  // Normal users: issue full session immediately
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  });

  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  await createAuditLog({
    userId: user.id,
    actionType: "login",
    req,
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status,
      personnelNo: user.personnelNo,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await createAuditLog({
    userId: req.user?.id,
    actionType: "logout",
    req,
  });

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(401).json({ error: "Kullanıcı bulunamadı" });
    return;
  }
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

export default router;
