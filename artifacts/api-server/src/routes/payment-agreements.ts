import { Router, type IRouter } from "express";
import { db, paymentAgreementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Kalan tutar ve ödeme durumunu totalAmount/paidAmount'tan türet
function computeDerived(totalAmount: number, paidAmount: number) {
  const remaining = Math.max(0, totalAmount - paidAmount);
  let paymentStatus: "Ödenmedi" | "Kısmi Ödendi" | "Tam Ödendi";
  if (paidAmount <= 0) {
    paymentStatus = "Ödenmedi";
  } else if (paidAmount >= totalAmount) {
    paymentStatus = "Tam Ödendi";
  } else {
    paymentStatus = "Kısmi Ödendi";
  }
  return { remainingAmount: remaining, paymentStatus };
}

// DB satırını dönüştür: string numeric → number + türetilmiş alanlar ekle
function withDerived(row: typeof paymentAgreementsTable.$inferSelect) {
  const total = parseFloat(row.totalAmount ?? "0");
  const paid  = parseFloat(row.paidAmount  ?? "0");
  const { remainingAmount, paymentStatus } = computeDerived(total, paid);
  return { ...row, totalAmount: total, paidAmount: paid, remainingAmount, paymentStatus };
}

interface ValidBody {
  instagramAccounts: string;
  startDate: string;
  endDate: string;
  notes?: string;
  totalAmount: number;
  paidAmount: number;
}

function validateBody(body: unknown): ValidBody | { error: string } {
  if (!body || typeof body !== "object") return { error: "Geçersiz istek gövdesi" };
  const b = body as Record<string, unknown>;

  if (typeof b.instagramAccounts !== "string" || !b.instagramAccounts.trim())
    return { error: "En az bir Instagram hesabı giriniz" };
  if (typeof b.startDate !== "string" || !DATE_RE.test(b.startDate))
    return { error: "Geçersiz başlangıç tarihi formatı (yyyy-MM-dd)" };
  if (typeof b.endDate !== "string" || !DATE_RE.test(b.endDate))
    return { error: "Geçersiz bitiş tarihi formatı (yyyy-MM-dd)" };

  const totalAmount = b.totalAmount !== undefined ? Number(b.totalAmount) : 0;
  const paidAmount  = b.paidAmount  !== undefined ? Number(b.paidAmount)  : 0;

  if (isNaN(totalAmount) || totalAmount < 0)
    return { error: "Toplam tutar geçersiz veya negatif olamaz" };
  if (isNaN(paidAmount) || paidAmount < 0)
    return { error: "Ödenen tutar geçersiz veya negatif olamaz" };
  if (paidAmount > totalAmount)
    return { error: "Ödenen tutar, toplam tutardan fazla olamaz" };

  return {
    instagramAccounts: b.instagramAccounts.trim(),
    startDate: b.startDate,
    endDate: b.endDate,
    notes: typeof b.notes === "string" ? b.notes : undefined,
    totalAmount,
    paidAmount,
  };
}

router.get("/payment-agreements", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(paymentAgreementsTable)
    .orderBy(paymentAgreementsTable.endDate);
  res.json(rows.map(withDerived));
});

router.post("/payment-agreements", requireAdmin, async (req, res): Promise<void> => {
  const result = validateBody(req.body);
  if ("error" in result) { res.status(400).json({ error: result.error }); return; }

  const { instagramAccounts, startDate, endDate, notes, totalAmount, paidAmount } = result;

  if (endDate < startDate) {
    res.status(400).json({ error: "Bitiş tarihi başlangıç tarihinden önce olamaz" });
    return;
  }

  const [row] = await db
    .insert(paymentAgreementsTable)
    .values({ instagramAccounts, startDate, endDate, notes: notes ?? null, totalAmount: String(totalAmount), paidAmount: String(paidAmount) })
    .returning();

  res.status(201).json(withDerived(row));
});

router.patch("/payment-agreements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(paymentAgreementsTable).where(eq(paymentAgreementsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Kayıt bulunamadı" }); return; }

  const b = req.body as Record<string, unknown>;
  const updates: Record<string, string | null> = {};

  if (b.instagramAccounts !== undefined) {
    if (typeof b.instagramAccounts !== "string" || !b.instagramAccounts.trim()) {
      res.status(400).json({ error: "En az bir Instagram hesabı giriniz" }); return;
    }
    updates.instagramAccounts = b.instagramAccounts.trim();
  }
  if (b.startDate !== undefined) {
    if (typeof b.startDate !== "string" || !DATE_RE.test(b.startDate)) {
      res.status(400).json({ error: "Geçersiz başlangıç tarihi formatı" }); return;
    }
    updates.startDate = b.startDate;
  }
  if (b.endDate !== undefined) {
    if (typeof b.endDate !== "string" || !DATE_RE.test(b.endDate)) {
      res.status(400).json({ error: "Geçersiz bitiş tarihi formatı" }); return;
    }
    updates.endDate = b.endDate;
  }
  if (b.notes !== undefined) {
    updates.notes = typeof b.notes === "string" ? b.notes : null;
  }

  // Para alanları: güncel veya mevcut değer
  const newTotal = b.totalAmount !== undefined ? Number(b.totalAmount) : parseFloat(existing.totalAmount ?? "0");
  const newPaid  = b.paidAmount  !== undefined ? Number(b.paidAmount)  : parseFloat(existing.paidAmount  ?? "0");

  if (b.totalAmount !== undefined || b.paidAmount !== undefined) {
    if (isNaN(newTotal) || newTotal < 0) { res.status(400).json({ error: "Toplam tutar geçersiz" }); return; }
    if (isNaN(newPaid)  || newPaid  < 0) { res.status(400).json({ error: "Ödenen tutar geçersiz" }); return; }
    if (newPaid > newTotal) { res.status(400).json({ error: "Ödenen tutar, toplam tutardan fazla olamaz" }); return; }
    if (b.totalAmount !== undefined) updates.totalAmount = String(newTotal);
    if (b.paidAmount  !== undefined) updates.paidAmount  = String(newPaid);
  }

  const finalStart = updates.startDate ?? existing.startDate;
  const finalEnd   = updates.endDate   ?? existing.endDate;
  if (finalEnd < finalStart) {
    res.status(400).json({ error: "Bitiş tarihi başlangıç tarihinden önce olamaz" }); return;
  }

  const [updated] = await db.update(paymentAgreementsTable).set(updates).where(eq(paymentAgreementsTable.id, id)).returning();
  res.json(withDerived(updated));
});

router.delete("/payment-agreements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(paymentAgreementsTable).where(eq(paymentAgreementsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Kayıt bulunamadı" }); return; }

  await db.delete(paymentAgreementsTable).where(eq(paymentAgreementsTable.id, id));
  res.status(204).send();
});

export default router;
