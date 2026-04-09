import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const instagramAccountsTable = pgTable("instagram_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  instagramUsername: text("instagram_username").notNull(),
  profileUrl: text("profile_url"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstagramAccountSchema = createInsertSchema(instagramAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstagramAccount = z.infer<typeof insertInstagramAccountSchema>;
export type InstagramAccount = typeof instagramAccountsTable.$inferSelect;
