import { useState, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format, parseISO, isToday, isBefore, startOfToday } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, X, FileText, Trash2, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

type SortKey = "endDate" | "remainingAmount";
type SortDir = "asc" | "desc";

interface Agreement {
  id: number;
  instagramAccounts: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "Ödenmedi" | "Kısmi Ödendi" | "Tam Ödendi";
  createdAt: string;
  updatedAt: string;
}

type AgreementStatus = "Aktif" | "Bugun Bitiyor" | "Suresi Doldu";

function getStatus(endDate: string): AgreementStatus {
  const end = parseISO(endDate);
  if (isToday(end)) return "Bugun Bitiyor";
  if (isBefore(end, startOfToday())) return "Suresi Doldu";
  return "Aktif";
}

function StatusBadge({ endDate }: { endDate: string }) {
  const status = getStatus(endDate);
  if (status === "Aktif")
    return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Aktif</Badge>;
  if (status === "Bugun Bitiyor")
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Bugün Bitiyor</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Süresi Doldu</Badge>;
}

function PaymentStatusBadge({ status }: { status: Agreement["paymentStatus"] }) {
  if (status === "Tam Ödendi")
    return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Tam Ödendi</Badge>;
  if (status === "Kısmi Ödendi")
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Kısmi Ödendi</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">Ödenmedi</Badge>;
}

// Para formatı: 1234.50 → "₺1.234,50"
function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(n);
}

function AccountTags({ accounts, onChange }: { accounts: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addAccount(raw: string) {
    const values = raw.split(/[,\s]+/).map(v => {
      const trimmed = v.trim().replace(/^@/, "");
      return trimmed ? `@${trimmed}` : "";
    }).filter(Boolean);
    const next = [...accounts];
    for (const v of values) if (!next.includes(v)) next.push(v);
    onChange(next);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addAccount(input);
    } else if (e.key === "Backspace" && !input && accounts.length > 0) {
      onChange(accounts.slice(0, -1));
    }
  }

  return (
    <div
      className="min-h-[42px] w-full border border-input rounded-md px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      onClick={() => inputRef.current?.focus()}
    >
      {accounts.map((acc, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-sm font-mono">
          {acc}
          <button type="button" onClick={() => onChange(accounts.filter((_, j) => j !== i))} className="hover:text-destructive ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addAccount(input); }}
        placeholder={accounts.length === 0 ? "@hesap_adi (Enter veya virgül ile ekle)" : ""}
        className="flex-1 min-w-[180px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

interface FormState {
  accounts: string[];
  startDate: string;
  endDate: string;
  notes: string;
  totalAmount: string;
  paidAmount: string;
}

const emptyForm = (): FormState => ({
  accounts: [],
  startDate: format(new Date(), "yyyy-MM-dd"),
  endDate: "",
  notes: "",
  totalAmount: "",
  paidAmount: "0",
});

function agreementToForm(a: Agreement): FormState {
  return {
    accounts: a.instagramAccounts.split(",").map(s => s.trim()).filter(Boolean),
    startDate: a.startDate,
    endDate: a.endDate,
    notes: a.notes ?? "",
    totalAmount: String(a.totalAmount),
    paidAmount: String(a.paidAmount),
  };
}

// Formdan türetilen ödeme bilgileri
function derivePayment(totalStr: string, paidStr: string) {
  const total = parseFloat(totalStr) || 0;
  const paid  = parseFloat(paidStr)  || 0;
  const remaining = Math.max(0, total - paid);
  let paymentStatus: Agreement["paymentStatus"] = "Ödenmedi";
  if (paid > 0 && paid < total) paymentStatus = "Kısmi Ödendi";
  else if (paid > 0 && paid >= total) paymentStatus = "Tam Ödendi";
  return { total, paid, remaining, paymentStatus };
}

export default function AdminOdemeTakip() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agreement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  }

  const { data: agreements, isLoading } = useQuery<Agreement[]>({
    queryKey: ["payment-agreements"],
    queryFn: () => customFetch("/api/payment-agreements"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/payment-agreements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Kayıt silindi" });
      queryClient.invalidateQueries({ queryKey: ["payment-agreements"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Hata", description: e?.message ?? "Bir hata oluştu", variant: "destructive" }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-agreements"] });

  // Form doğrulama
  function getFormError(): string | null {
    if (form.accounts.length === 0) return "En az bir Instagram hesabı giriniz";
    if (!form.startDate || !form.endDate) return "Başlangıç ve bitiş tarihlerini giriniz";
    const total = parseFloat(form.totalAmount);
    const paid  = parseFloat(form.paidAmount);
    if (form.totalAmount && (isNaN(total) || total < 0)) return "Toplam tutar geçerli bir sayı olmalı";
    if (isNaN(paid) || paid < 0) return "Ödenen tutar geçerli bir sayı olmalı";
    if (!isNaN(total) && !isNaN(paid) && paid > total) return "Ödenen tutar toplam tutardan fazla olamaz";
    return null;
  }

  async function handleSave() {
    const err = getFormError();
    if (err) { toast({ title: "Hata", description: err, variant: "destructive" }); return; }

    const body = {
      instagramAccounts: form.accounts.join(", "),
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes || undefined,
      totalAmount: parseFloat(form.totalAmount) || 0,
      paidAmount:  parseFloat(form.paidAmount)  || 0,
    };

    setSaving(true);
    try {
      if (editTarget) {
        await customFetch(`/api/payment-agreements/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Kayıt güncellendi" });
      } else {
        await customFetch("/api/payment-agreements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Kayıt oluşturuldu" });
      }
      invalidate();
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Hata", description: e?.message ?? "Bir hata oluştu", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openNew() { setEditTarget(null); setForm(emptyForm()); setOpen(true); }
  function openEdit(a: Agreement) { setEditTarget(a); setForm(agreementToForm(a)); setOpen(true); }

  const { remaining: formRemaining, paymentStatus: formPaymentStatus } = derivePayment(form.totalAmount, form.paidAmount);

  const sorted = [...(agreements ?? [])].sort((a, b) => {
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "endDate") return a.endDate.localeCompare(b.endDate) * dir;
      if (sortKey === "remainingAmount") return (a.remainingAmount - b.remainingAmount) * dir;
    }
    // Varsayılan: durum önce, ardından bitiş tarihi artan
    const sa = getStatus(a.endDate), sb = getStatus(b.endDate);
    const order: Record<AgreementStatus, number> = { "Bugun Bitiyor": 0, "Aktif": 1, "Suresi Doldu": 2 };
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return a.endDate.localeCompare(b.endDate);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ödeme Takip</h1>
          <p className="text-sm text-muted-foreground">Instagram hesabı anlaşmalarını yönet</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Kayıt
        </Button>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Anlaşma Listesi ({isLoading ? "…" : sorted.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Instagram Hesapları</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Başlangıç</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort("endDate")}
                      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sortKey === "endDate" ? "text-foreground" : ""}`}
                    >
                      Bitiş <SortIcon col="endDate" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Toplam Tutar</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ödenen</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort("remainingAmount")}
                      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto ${sortKey === "remainingAmount" ? "text-foreground" : ""}`}
                    >
                      Kalan <SortIcon col="remainingAmount" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ödeme Durumu</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      Henüz kayıt yok. "Yeni Kayıt" butonuyla ekleyebilirsiniz.
                    </td>
                  </tr>
                ) : (
                  sorted.map(a => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.instagramAccounts.split(",").map(s => s.trim()).filter(Boolean).map((acc, i) => (
                            <span key={i} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{acc}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(parseISO(a.startDate), "d MMM yyyy", { locale: tr })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(parseISO(a.endDate), "d MMM yyyy", { locale: tr })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge endDate={a.endDate} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                        {a.totalAmount > 0 ? fmt(a.totalAmount) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-green-700">
                        {a.paidAmount > 0 ? fmt(a.paidAmount) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {a.remainingAmount > 0
                          ? <span className="text-amber-700 font-medium">{fmt(a.remainingAmount)}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={a.paymentStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="gap-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(a)}
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ekleme / Düzenleme Modalı */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Kaydı Düzenle" : "Yeni Anlaşma Kaydı"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Instagram hesapları */}
            <div className="space-y-1.5">
              <Label>Instagram Hesapları</Label>
              <AccountTags
                accounts={form.accounts}
                onChange={v => setForm(f => ({ ...f, accounts: v }))}
              />
              <p className="text-xs text-muted-foreground">
                Virgül ile ayırarak veya Enter'a basarak birden fazla hesap ekleyebilirsiniz
              </p>
            </div>

            {/* Tarihler */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Bitiş Tarihi</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  min={form.startDate}
                />
              </div>
            </div>

            {/* Para alanları */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="totalAmount">Toplam Anlaşma Tutarı (₺)</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paidAmount">Ödenen Tutar (₺)</Label>
                <Input
                  id="paidAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.paidAmount}
                  onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
                />
              </div>
            </div>

            {/* Otomatik hesaplanan alanlar */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kalan Tutar</span>
                <span className={`font-medium tabular-nums ${formRemaining > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {formRemaining > 0 ? fmt(formRemaining) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ödeme Durumu</span>
                <PaymentStatusBadge status={formPaymentStatus} />
              </div>
            </div>

            {/* Notlar */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                placeholder="İsteğe bağlı notlar..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor…" : editTarget ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme onayı */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.instagramAccounts}</strong> anlaşması kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
