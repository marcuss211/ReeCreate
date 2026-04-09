import { Router, type IRouter } from "express";
import { db, dailyReportsTable, reportItemsTable, usersTable, instagramAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { ExportDailyReportQueryParams } from "@workspace/api-zod";

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
        date: report.date,
        userName: report.userName ?? "",
        personnelNo: report.personnelNo ?? "",
        reportStatus: report.status,
        adminNote: report.adminNote ?? "",
        instagramUsername: "",
        reelsUrl: "",
        contentDate: "",
        enteredAt: "",
      });
    } else {
      for (const item of items) {
        rows.push({
          date: report.date,
          userName: report.userName ?? "",
          personnelNo: report.personnelNo ?? "",
          reportStatus: report.status,
          adminNote: report.adminNote ?? "",
          instagramUsername: item.instagramUsername ?? "",
          reelsUrl: item.reelsUrl,
          contentDate: item.contentDate,
          enteredAt: item.enteredAt,
        });
      }
    }
  }

  const csv = toCSV(rows);
  const filename = `daily-report-${date}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
