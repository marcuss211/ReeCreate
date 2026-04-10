import { Router, type IRouter } from "express";
import { db, reportItemsTable, dailyReportsTable, instagramAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { reportSubmitRateLimit } from "../middlewares/rate-limit";
import {
  CreateReportItemBody,
  DeleteReportItemParams,
} from "@workspace/api-zod";

const REELS_URL_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels)\/[A-Za-z0-9_-]{5,30}\/?(\?[^\s]*)?$/i;

function normalizeReelsUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (!["www.instagram.com", "instagram.com"].includes(parsed.hostname)) {
      return url;
    }

    const match = parsed.pathname.match(/\/(reel|reels)\/([A-Za-z0-9_-]+)/);
    if (match) {
      return `https://www.instagram.com/reel/${match[2]}/`;
    }
  } catch {
    // fall through
  }
  return url;
}

const router: IRouter = Router();

router.post("/report-items", requireAuth, reportSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = CreateReportItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { reportId, instagramAccountId, reelsUrl, contentDate } = parsed.data;

  if (!REELS_URL_REGEX.test(reelsUrl)) {
    res.status(400).json({
      error: "Geçersiz reel URL. URL şu formatta olmalıdır: https://www.instagram.com/reel/XXXX/",
    });
    return;
  }

  const normalizedUrl = normalizeReelsUrl(reelsUrl);

  const [report] = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.id, reportId));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (req.user?.role !== "admin" && report.userId !== req.user?.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [account] = await db
    .select()
    .from(instagramAccountsTable)
    .where(eq(instagramAccountsTable.id, instagramAccountId));

  if (!account) {
    res.status(400).json({ error: "Instagram hesabı bulunamadı" });
    return;
  }

  if (account.status !== "active") {
    res.status(400).json({ error: "Instagram hesabı aktif değil" });
    return;
  }

  if (req.user?.role !== "admin" && account.userId !== req.user?.id) {
    res.status(403).json({ error: "Bu Instagram hesabına erişim izniniz yok" });
    return;
  }

  const [duplicate] = await db
    .select()
    .from(reportItemsTable)
    .where(and(eq(reportItemsTable.reelsUrl, normalizedUrl), eq(reportItemsTable.reportId, reportId)));

  if (duplicate) {
    res.status(400).json({ error: "Bu reel zaten bu rapora eklenmiş" });
    return;
  }

  const [item] = await db.insert(reportItemsTable).values({
    reportId,
    instagramAccountId,
    reelsUrl: normalizedUrl,
    contentDate,
  }).returning();

  if (report.status === "submitted" || report.status === "approved") {
    await db.update(dailyReportsTable)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(dailyReportsTable.id, reportId));
  }

  res.status(201).json(item);
});

router.delete("/report-items/:id", requireAuth, async (req, res): Promise<void> => {
  const paramsResult = DeleteReportItemParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { id } = paramsResult.data;

  const [item] = await db.select().from(reportItemsTable).where(eq(reportItemsTable.id, id));
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const [report] = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.id, item.reportId));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (req.user?.role !== "admin" && report.userId !== req.user?.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(reportItemsTable).where(eq(reportItemsTable.id, id));

  if (report.status === "submitted" || report.status === "approved") {
    await db.update(dailyReportsTable)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(dailyReportsTable.id, item.reportId));
  }

  res.sendStatus(204);
});

export default router;
