import { useState } from "react";
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
import { Instagram, Loader2, ShieldCheck } from "lucide-react";
import { Redirect, useLocation } from "wouter";

const codeSchema = z.object({
  code: z
    .string()
    .min(6, "6 haneli kod giriniz")
    .max(6, "6 haneli kod giriniz")
    .regex(/^\d{6}$/, "Yalnızca rakam giriniz"),
});

export default function TwoFactorVerify() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  if (user) {
    return <Redirect to="/admin/dashboard" />;
  }

  async function onSubmit(values: z.infer<typeof codeSchema>) {
    setSubmitting(true);
    try {
      const result = await customFetch<{ user: Parameters<typeof login>[0] }>(
        "/api/auth/2fa/verify",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: values.code }),
        },
      );

      toast({
        title: "Giriş başarılı",
        description: "Hoş geldiniz!",
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
      } else if (msg.includes("expired") || msg.includes("Pre-auth")) {
        toast({
          title: "Oturum süresi doldu",
          description: "Lütfen tekrar giriş yapın.",
          variant: "destructive",
        });
        setLocation("/login");
      } else {
        form.setError("code", { message: "Geçersiz kod. Tekrar deneyin." });
        form.setValue("code", "");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Instagram className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">İki Faktörlü Doğrulama</h1>
          <p className="text-sm text-muted-foreground">
            Google Authenticator uygulamasından 6 haneli kodu girin
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doğrulama Kodu</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
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
                Doğrula ve Giriş Yap
              </Button>
            </form>
          </Form>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Farklı hesapla giriş yap
          </button>
        </div>
      </div>
    </div>
  );
}
