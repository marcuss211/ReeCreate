import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { dailyReportsTable } from "./daily-reports";

export const delayFlagsTable = pgTable("delay_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  reportId: integer("report_id").references(() => dailyReportsTable.id),
  delayDayCount: integer("delay_day_count").notNull().default(0),
  isRepeatIssue: integer("is_repeat_issue").notNull().default(0),
  isBulkEntryFlag: integer("is_bulk_entry_flag").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDelayFlagSchema = createInsertSchema(delayFlagsTable).omit({ id: true, createdAt: true });
export type InsertDelayFlag = z.infer<typeof insertDelayFlagSchema>;
export type DelayFlag = typeof delayFlagsTable.$inferSelect;
