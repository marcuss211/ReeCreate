import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
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
import { Instagram, Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";

const loginSchema = z.object({
  username: z.string().min(1, "Kullanıcı adı zorunludur"),
  password: z.string().min(1, "Şifre zorunludur"),
});

export default function Login() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"} />;
  }

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        const response = data as unknown as Record<string, unknown>;

        if (response.status === "2fa_setup_required") {
          setLocation("/admin/2fa-setup");
          return;
        }

        if (response.status === "2fa_required") {
          setLocation("/admin/2fa-verify");
          return;
        }

        if (response.user) {
          login(response.user as Parameters<typeof login>[0]);
          toast({
            title: "Giriş başarılı",
            description: "Hoş geldiniz!",
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Giriş başarısız",
          description: error.message || "Geçersiz kullanıcı adı veya şifre",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Instagram className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Hoş Geldiniz</h1>
          <p className="text-sm text-muted-foreground">
            Devam etmek için giriş yapın
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kullanıcı Adı</FormLabel>
                    <FormControl>
                      <Input placeholder="Kullanıcı adınızı girin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Şifre</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Şifrenizi girin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Giriş Yap
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
