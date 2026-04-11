import { Badge } from "@/components/ui/badge";

export function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft": return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200">Taslak</Badge>;
    case "submitted": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Onay Bekliyor</Badge>;
    case "approved": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Onaylandı</Badge>;
    case "missing": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Eksik</Badge>;
    case "rejected": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Reddedildi</Badge>;
    case "late": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Geç</Badge>;
    case "bulk_flagged": return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Toplu Giriş</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export function UserStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Aktif</Badge>;
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">Pasif</Badge>;
}

export function WalletStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Aktif</Badge>;
  if (status === "replaced") return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">Değiştirildi</Badge>;
  if (status === "flagged") return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">İşaretlendi</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function BehaviorBadge({ behavior }: { behavior: string }) {
  switch (behavior) {
    case "normal": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Normal</Badge>;
    case "often delayed": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Sık Gecikmeli</Badge>;
    case "2+ days delayed": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">2+ Gün Gecikmeli</Badge>;
    case "bulk entry suspected": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Toplu Giriş Şüphesi</Badge>;
    case "needs attention": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Dikkat Gerekiyor</Badge>;
    default: return <Badge variant="outline">{behavior}</Badge>;
  }
}
