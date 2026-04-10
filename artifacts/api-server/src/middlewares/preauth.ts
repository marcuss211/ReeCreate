import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getSecret(): string {
  return process.env.SESSION_SECRET!;
}

export const PRE_AUTH_COOKIE_NAME = "pre_auth_token";

export const PRE_AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 5 * 60 * 1000,
  path: "/",
};

export const PRE_AUTH_CLEAR_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export interface PreAuthPayload {
  id: number;
  username: string;
  role: string;
  name: string;
  preAuth: true;
}

declare global {
  namespace Express {
    interface Request {
      preAuthUser?: PreAuthPayload;
    }
  }
}

export function signPreAuthToken(user: Omit<PreAuthPayload, "preAuth">): string {
  return jwt.sign({ ...user, preAuth: true }, getSecret(), { expiresIn: "5m" });
}

export async function requirePreAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[PRE_AUTH_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Pre-authentication required. Please start the login process." });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as PreAuthPayload;
    if (!payload.preAuth) {
      res.status(401).json({ error: "Invalid pre-auth token" });
      return;
    }
    req.preAuthUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Pre-auth token expired. Please log in again." });
  }
}
