import { Badge } from "@/components/ui/badge";

export function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft": return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200">Draft</Badge>;
    case "submitted": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Submitted</Badge>;
    case "approved": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Approved</Badge>;
    case "missing": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Missing</Badge>;
    case "rejected": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Rejected</Badge>;
    case "late": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Late</Badge>;
    case "bulk_flagged": return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Bulk Flagged</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export function UserStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>;
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">Passive</Badge>;
}

export function WalletStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>;
  if (status === "replaced") return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">Replaced</Badge>;
  if (status === "flagged") return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Flagged</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function BehaviorBadge({ behavior }: { behavior: string }) {
  switch (behavior) {
    case "normal": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Normal</Badge>;
    case "often delayed": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Often Delayed</Badge>;
    case "2+ days delayed": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">2+ Days Delayed</Badge>;
    case "bulk entry suspected": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Bulk Entry Suspected</Badge>;
    case "needs attention": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Needs Attention</Badge>;
    default: return <Badge variant="outline">{behavior}</Badge>;
  }
}
