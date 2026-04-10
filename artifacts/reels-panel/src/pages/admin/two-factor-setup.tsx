import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Instagram, Loader2, Copy, CheckCheck, ShieldCheck } from "lucide-react";
import { Redirect, useLocation } from "wouter";

const codeSchema = z.object({
  code: z
    .string()
    .min(6, "6 haneli kod giriniz")
    .max(6, "6 haneli kod giriniz")
    .regex(/^\d{6}$/, "Yalnızca rakam giriniz"),
});

interface SetupData {
  qrCodeDataUrl: string;
  manualKey: string;
}

export default function TwoFactorSetup() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  // If already logged in, redirect
  if (user) {
    return <Redirect to="/admin/dashboard" />;
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingSetup(true);
    setSetupError(null);

    customFetch<SetupData>("/api/auth/2fa/setup", {
      method: "POST",
      credentials: "include",
    })
      .then((data) => {
        if (!cancelled) setSetupData(data);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          const msg = err.message || "2FA kurulumu başlatılamadı.";
          if (msg.includes("Pre-auth") || msg.includes("expired")) {
            setSetupError("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
          } else {
            setSetupError(msg);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSetup(false);
      });

    return () => { cancelled = true; };
  }, []);

  function copyKey() {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.manualKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function onSubmit(values: z.infer<typeof codeSchema>) {
    setSubmitting(true);
    try {
      const result = await customFetch<{ user: Parameters<typeof login>[0] }>(
        "/api/auth/2fa/verify-setup",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: values.code }),
        },
      );

      toast({
        title: "2FA Kurulumu Tamamlandı",
        description: "Google Authenticator başarıyla etkinleştirildi.",
      });
      login(result.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Doğrulama başarısız.";
      if (msg.includes("Too many")) {
        toast({
          title: "Çok fazla deneme",
          description: "15 dakika sonra tekrar deneyiniz.",
          variant: "destructive",
        });
      } else {
        form.setError("code", { message: "Geçersiz kod. Lütfen tekrar deneyin." });
        form.setValue("code", "");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Instagram className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">2FA Kurulumu</h1>
          <p className="text-sm text-muted-foreground">
            Admin hesabınızı korumak için Google Authenticator kurulumu zorunludur
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
          {loadingSetup ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">QR kodu oluşturuluyor...</p>
            </div>
          ) : setupError ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center">
                <p className="text-sm text-destructive font-medium">{setupError}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/login")}>
                Giriş Sayfasına Dön
              </Button>
            </div>
          ) : setupData ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                  Google Authenticator uygulamasını açın ve QR kodu tarayın
                </div>
                <div className="flex justify-center">
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="Google Authenticator QR Code"
                    className="h-48 w-48 rounded-lg border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  QR tarayamıyorsanız manuel girin
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                  <code className="flex-1 break-all text-xs font-mono text-foreground">
                    {setupData.manualKey}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={copyKey}
                  >
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                  Uygulamadan aldığınız 6 haneli kodu girin
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Doğrulama Kodu</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="000000"
                              maxLength={6}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              className="text-center text-2xl tracking-[0.5em] font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Kurulumu Tamamla
                    </Button>
                  </form>
                </Form>
              </div>
            </>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Bu adım zorunludur. Tamamlamadan admin paneline erişilemez.
        </p>
      </div>
    </div>
  );
}
