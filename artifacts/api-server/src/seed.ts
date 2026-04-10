import bcrypt from "bcryptjs";
import { db, usersTable, instagramAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

export async function seed() {
  logger.info("Seeding database...");

  const adminHash = await bcrypt.hash("admin123", 12);
  const userHash = await bcrypt.hash("password123", 12);

  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existingAdmin) {
    await db.update(usersTable).set({ passwordHash: adminHash }).where(eq(usersTable.username, "admin"));
    logger.info("Updated admin password hash");
  } else {
    await db.insert(usersTable).values({
      name: "Admin User",
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
      personnelNo: null,
    });
    logger.info("Created admin user");
  }

  for (const userData of [
    { name: "Ahmet Yilmaz", username: "ahmet", personnelNo: 347 },
    { name: "Mehmet Kaya", username: "mehmet", personnelNo: 412 },
    { name: "Ayse Demir", username: "ayse", personnelNo: 523 },
  ]) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, userData.username));
    if (existing) {
      await db.update(usersTable).set({ passwordHash: userHash }).where(eq(usersTable.username, userData.username));
      logger.info(`Updated password for ${userData.username}`);
    } else {
      await db.insert(usersTable).values({
        name: userData.name,
        username: userData.username,
        passwordHash: userHash,
        role: "user",
        status: "active",
        personnelNo: userData.personnelNo,
      });
      logger.info(`Created user ${userData.username}`);
    }
  }

  logger.info("Seed complete. Admin: admin/admin123, Users: ahmet,mehmet,ayse/password123");
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith("seed.mjs")) {
  seed().catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exit(1);
  });
}
