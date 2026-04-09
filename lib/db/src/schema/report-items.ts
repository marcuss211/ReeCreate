import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dailyReportsTable } from "./daily-reports";
import { instagramAccountsTable } from "./instagram-accounts";

export const reportItemsTable = pgTable("report_items", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => dailyReportsTable.id),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccountsTable.id),
  reelsUrl: text("reels_url").notNull(),
  contentDate: text("content_date").notNull(),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportItemSchema = createInsertSchema(reportItemsTable).omit({ id: true, createdAt: true, enteredAt: true });
export type InsertReportItem = z.infer<typeof insertReportItemSchema>;
export type ReportItem = typeof reportItemsTable.$inferSelect;
