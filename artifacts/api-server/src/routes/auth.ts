import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../middlewares/auth";
import { createAuditLog } from "../lib/audit";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status !== "active") {
    res.status(401).json({ error: "Account is inactive" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role, name: user.name });

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
    token,
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await createAuditLog({
    userId: req.user?.id,
    actionType: "logout",
    req,
  });
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(401).json({ error: "User not found" });
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
