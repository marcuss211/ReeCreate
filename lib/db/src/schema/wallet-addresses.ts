import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletAddressesTable = pgTable("wallet_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  network: text("network").notNull().default("TRC20"),
  walletAddress: text("wallet_address").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const walletAddressLogsTable = pgTable("wallet_address_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  oldWalletAddress: text("old_wallet_address"),
  newWalletAddress: text("new_wallet_address").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: integer("changed_by").references(() => usersTable.id),
  note: text("note"),
});

export const insertWalletAddressSchema = createInsertSchema(walletAddressesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalletAddress = z.infer<typeof insertWalletAddressSchema>;
export type WalletAddress = typeof walletAddressesTable.$inferSelect;
export type WalletAddressLog = typeof walletAddressLogsTable.$inferSelect;
