import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit } from "./middlewares/rate-limit";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigin = process.env.CORS_ORIGIN;
const isProduction = process.env.NODE_ENV === "production";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

function isTrustedOrigin(origin: string): boolean {
  if (allowedOrigin) return origin === allowedOrigin;
  return (
    origin.endsWith(".replit.app") ||
    origin.endsWith(".repl.co") ||
    origin.endsWith(".replit.dev")
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (!isProduction) {
        callback(null, true);
        return;
      }
      if (isTrustedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(globalRateLimit);

app.use("/api", router);

if (isProduction) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir =
    process.env.FRONTEND_DIST_DIR ?? path.resolve(__dirname, "public");

  if (existsSync(staticDir)) {
    app.use(express.static(staticDir, { maxAge: "1d", etag: true }));
    app.get(/(.*)/, (_req: Request, res: Response) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving frontend static files");
  } else {
    logger.warn(
      { staticDir },
      "Frontend static directory not found — running in API-only mode",
    );
  }
}

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  }

  if (isProduction) {
    res.status(500).json({ error: "Internal server error" });
  } else {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    res.status(500).json({ error: message, stack });
  }
});

export default app;
