import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentAgreementsTable = pgTable("payment_agreements", {
  id: serial("id").primaryKey(),
  instagramAccounts: text("instagram_accounts").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentAgreementSchema = createInsertSchema(paymentAgreementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentAgreement = z.infer<typeof insertPaymentAgreementSchema>;
export type PaymentAgreement = typeof paymentAgreementsTable.$inferSelect;
