import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Table } from "lucide-react";
import { format } from "date-fns";

export default function AdminExport() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleExport = (fmt: "csv" | "xlsx") => {
    const url = `/api/export/daily-report?date=${date}&format=${fmt}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${date}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Reports</h1>
        <p className="text-sm text-muted-foreground">Download daily reels reports in CSV or Excel format</p>
      </div>

      <Card className="border-card-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Daily Report Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Report Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 gap-2" variant="outline" onClick={() => handleExport("csv")}>
              <FileText className="h-4 w-4" />
              Export CSV
            </Button>
            <Button className="flex-1 gap-2" onClick={() => handleExport("xlsx")}>
              <Table className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Exports include: date, user name, personnel number, report status, admin notes, Instagram accounts, reels URLs, content dates, and entry times.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
