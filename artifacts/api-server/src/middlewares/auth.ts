import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "fallback-secret-change-in-production";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id));
    if (!user || user.status !== "active") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
