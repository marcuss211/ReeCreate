import { Router, type IRouter } from "express";
import { db, dailyReportsTable, reportItemsTable, usersTable, instagramAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { ExportDailyReportQueryParams } from "@workspace/api-zod";
import * as XLSX from "xlsx";

const router: IRouter = Router();

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => {
        const v = row[h];
        if (v == null) return "";
        const str = String(v);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

router.get("/export/daily-report", requireAdmin, async (req, res): Promise<void> => {
  const params = ExportDailyReportQueryParams.safeParse(req.query);
  const date = params.success && params.data.date ? params.data.date : new Date().toISOString().split("T")[0];
  const format = params.success && params.data.format ? params.data.format : "csv";

  const reports = await db
    .select({
      id: dailyReportsTable.id,
      userId: dailyReportsTable.userId,
      date: dailyReportsTable.date,
      status: dailyReportsTable.status,
      adminNote: dailyReportsTable.adminNote,
      submittedAt: dailyReportsTable.submittedAt,
      userName: usersTable.name,
      personnelNo: usersTable.personnelNo,
    })
    .from(dailyReportsTable)
    .leftJoin(usersTable, eq(dailyReportsTable.userId, usersTable.id))
    .where(eq(dailyReportsTable.date, date));

  const rows: Record<string, unknown>[] = [];

  for (const report of reports) {
    const items = await db
      .select({
        reelsUrl: reportItemsTable.reelsUrl,
        contentDate: reportItemsTable.contentDate,
        enteredAt: reportItemsTable.enteredAt,
        instagramUsername: instagramAccountsTable.instagramUsername,
      })
      .from(reportItemsTable)
      .leftJoin(instagramAccountsTable, eq(reportItemsTable.instagramAccountId, instagramAccountsTable.id))
      .where(eq(reportItemsTable.reportId, report.id));

    if (items.length === 0) {
      rows.push({
        Tarih: report.date,
        "Kullanıcı Adı": report.userName ?? "",
        "Personel No": report.personnelNo ?? "",
        "Rapor Durumu": report.status,
        "Admin Notu": report.adminNote ?? "",
        "Instagram Hesabı": "",
        "Reels URL": "",
        "İçerik Tarihi": "",
        "Giriş Zamanı": "",
      });
    } else {
      for (const item of items) {
        rows.push({
          Tarih: report.date,
          "Kullanıcı Adı": report.userName ?? "",
          "Personel No": report.personnelNo ?? "",
          "Rapor Durumu": report.status,
          "Admin Notu": report.adminNote ?? "",
          "Instagram Hesabı": item.instagramUsername ?? "",
          "Reels URL": item.reelsUrl,
          "İçerik Tarihi": item.contentDate,
          "Giriş Zamanı": item.enteredAt,
        });
      }
    }
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Günlük Rapor");

    // Auto-size columns
    const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2,
    }));
    worksheet["!cols"] = colWidths;

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="gunluk-rapor-${date}.xlsx"`);
    res.send(buffer);
    return;
  }

  const csv = toCSV(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="gunluk-rapor-${date}.csv"`);
  res.send("\uFEFF" + csv); // BOM for proper Turkish character support in Excel
});

export default router;
