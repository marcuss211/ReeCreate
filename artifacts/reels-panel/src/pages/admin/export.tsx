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
    a.download = `gunluk-rapor-${date}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Raporları Dışa Aktar</h1>
        <p className="text-sm text-muted-foreground">Günlük reel raporlarını CSV veya Excel formatında indir</p>
      </div>

      <Card className="border-card-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Günlük Rapor Dışa Aktarma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Rapor Tarihi</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 gap-2" variant="outline" onClick={() => handleExport("csv")}>
              <FileText className="h-4 w-4" />
              CSV İndir
            </Button>
            <Button className="flex-1 gap-2" onClick={() => handleExport("xlsx")}>
              <Table className="h-4 w-4" />
              Excel İndir
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dışa aktarma şunları içerir: tarih, kullanıcı adı, personel numarası, rapor durumu, admin notları, Instagram hesapları, reel URL'leri, içerik tarihleri ve giriş zamanları.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
