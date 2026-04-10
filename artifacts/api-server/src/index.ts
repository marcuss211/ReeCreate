import app from "./app";
import { logger } from "./lib/logger";
import { seed } from "./seed";
import { db, usersTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrap() {
  try {
    const [anyUser] = await db.select().from(usersTable).limit(1);
    if (!anyUser) {
      logger.info("Empty database detected, running initial seed...");
      await seed();
    } else {
      logger.info("Database already seeded, skipping auto-seed");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed check failed, continuing without seed");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

bootstrap();
