import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => !isProd,
});

export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please wait before trying again." },
  skipSuccessfulRequests: true,
});

export const walletRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many wallet changes, please try again later." },
});

export const reportSubmitRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many report submissions, please slow down." },
});

export const twoFactorRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again in 15 minutes." },
});
