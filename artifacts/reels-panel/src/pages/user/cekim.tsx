import { useState } from "react";
import { useListWalletAddresses, useSetWalletAddress, useListWalletLogs, getListWalletAddressesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { WalletStatusBadge } from "@/components/status-badges";
import { useToast } from "@/hooks/use-toast";
import { Wallet, ArrowRight, CheckCircle, AlertCircle, Edit2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const walletSchema = z.object({
  walletAddress: z.string()
    .min(1, "Cüzdan adresi gerekli")
    .refine(v => TRC20_REGEX.test(v), "Geçerli bir TRC20 adresi giriniz (T ile başlamalı, tam 34 karakter)"),
  note: z.string().optional(),
});

export default function UserCekim() {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading: walletLoading } = useListWalletAddresses({});
  const { data: logs, isLoading: logsLoading } = useListWalletLogs({});
  const setMutation = useSetWalletAddress();

  const currentWallet = wallets?.[0];
  const sortedLogs = [...(logs ?? [])].reverse();

  const form = useForm<z.infer<typeof walletSchema>>({
    resolver: zodResolver(walletSchema),
    defaultValues: { walletAddress: currentWallet?.walletAddress ?? "", note: "" },
  });

  function onSubmit(values: z.infer<typeof walletSchema>) {
    setMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Cüzdan adresi güncellendi", description: "TRC20 adresiniz başarıyla kaydedildi." });
        setEditing(false);
        queryClient.invalidateQueries({ queryKey: getListWalletAddressesQueryKey({}) });
      },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  const walletValue = form.watch("walletAddress");
  const isValidTRC20 = TRC20_REGEX.test(walletValue ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cüzdan (Çekim)</h1>
        <p className="text-sm text-muted-foreground">USDT TRC20 çekim adresinizi yönetin</p>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Mevcut Cüzdan Adresi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {walletLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !currentWallet || editing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="walletAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>USDT TRC20 Adresi</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="T..."
                          {...field}
                          className={`font-mono pr-10 ${field.value && !isValidTRC20 ? "border-red-400" : field.value && isValidTRC20 ? "border-green-400" : ""}`}
                        />
                        {field.value && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isValidTRC20 ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground mt-1">
                      T ile başlamalı ve tam 34 karakter olmalıdır
                      {field.value && <span className="ml-2 font-mono">{field.value.length}/34</span>}
                    </p>
                  </FormItem>
                )} />
                <FormField control={form.control} name="note" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Not (isteğe bağlı)</FormLabel>
                    <FormControl><Input placeholder="Bu değişiklik hakkında not ekleyin" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="submit" className="gap-2" disabled={setMutation.isPending}>
                    <CheckCircle className="h-4 w-4" />
                    {currentWallet ? "Adresi Güncelle" : "Adresi Kaydet"}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>İptal</Button>
                  )}
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">TRC20 Adresi</p>
                  <p className="font-mono text-sm break-all">{currentWallet.walletAddress}</p>
                </div>
                <WalletStatusBadge status={currentWallet.status} />
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                setEditing(true);
                form.setValue("walletAddress", currentWallet.walletAddress);
              }}>
                <Edit2 className="h-3.5 w-3.5" />
                Adresi Güncelle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Değişiklik Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : sortedLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Henüz cüzdan değişikliği yok</p>
          ) : (
            <div className="space-y-2">
              {sortedLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm flex-wrap">
                  <div className="flex items-center gap-2 font-mono text-xs flex-1 min-w-0">
                    <span className="text-muted-foreground truncate">{log.oldWalletAddress ? `${log.oldWalletAddress.slice(0, 12)}...` : "Yeni"}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{log.newWalletAddress.slice(0, 12)}...</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.changedAt), "d MMM yyyy, HH:mm", { locale: tr })}
                  </span>
                  {log.note && <p className="text-xs text-muted-foreground italic w-full">{log.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
