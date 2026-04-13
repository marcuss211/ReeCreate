import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useResetUserPassword, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserStatusBadge } from "@/components/status-badges";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Key, UserX, UserCheck, User, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const createUserSchema = z.object({
  name: z.string().min(1, "Ad zorunludur"),
  username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalıdır"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  role: z.string().default("user"),
});

const editUserSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "En az 8 karakter olmalıdır"),
});

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<{ id: number; name: string; username: string; role: string; status: string; personnelNo?: number | null } | null>(null);
  const [resetUser, setResetUser] = useState<{ id: number; name: string } | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ id: number; name: string; username: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useListUsers({});
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const resetMutation = useResetUserPassword();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Kullanıcı silindi" });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });
      setDeleteUser(null);
    },
    onError: (e: any) => toast({ title: "Silinemedi", description: e?.message ?? "Bir hata oluştu", variant: "destructive" }),
  });

  const createForm = useForm<z.infer<typeof createUserSchema>>({ resolver: zodResolver(createUserSchema) });
  const editForm = useForm<z.infer<typeof editUserSchema>>({ resolver: zodResolver(editUserSchema) });
  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema) });

  const filtered = (users ?? []).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    String(u.personnelNo ?? "").includes(search)
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });

  function onCreateSubmit(values: z.infer<typeof createUserSchema>) {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Kullanıcı oluşturuldu" });
        setCreateOpen(false);
        createForm.reset();
        invalidate();
      },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  function onEditSubmit(values: z.infer<typeof editUserSchema>) {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data: values }, {
      onSuccess: () => {
        toast({ title: "Kullanıcı güncellendi" });
        setEditUser(null);
        invalidate();
      },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  function onResetSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!resetUser) return;
    resetMutation.mutate({ id: resetUser.id, data: values }, {
      onSuccess: () => {
        toast({ title: "Şifre sıfırlandı" });
        setResetUser(null);
        resetForm.reset();
      },
      onError: (e: any) => toast({ title: "Hata", description: e?.message, variant: "destructive" }),
    });
  }

  function toggleStatus(user: typeof users extends (infer T)[] | undefined ? T : never) {
    updateMutation.mutate({ id: user.id, data: { status: user.status === "active" ? "passive" : "active" } }, {
      onSuccess: () => {
        toast({ title: `Kullanıcı ${user.status === "active" ? "pasife alındı" : "aktife alındı"}` });
        invalidate();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kullanıcılar</h1>
          <p className="text-sm text-muted-foreground">Toplam {users?.length ?? 0} kullanıcı</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Kullanıcı Oluştur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Ad Soyad</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Kullanıcı Adı</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Şifre</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? "user"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="user">Kullanıcı</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Personel No</p>
                  <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">Otomatik atanacak</p>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Kullanıcı Oluştur</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Kullanıcı ara..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ad Soyad</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı Adı</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Personel No</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <User className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Kullanıcı bulunamadı
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.username}</td>
                      <td className="px-4 py-3">
                        {u.personnelNo ? (
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">#{u.personnelNo}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {u.role === "admin" ? "Admin" : "Kullanıcı"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><UserStatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Düzenle" onClick={() => {
                            setEditUser(u);
                            editForm.reset({ name: u.name, status: u.status, role: u.role });
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Şifre Sıfırla" onClick={() => setResetUser({ id: u.id, name: u.name })}>
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={u.status === "active" ? "Pasife Al" : "Aktife Al"} onClick={() => toggleStatus(u)}>
                            {u.status === "active" ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Kullanıcıyı Sil"
                            onClick={() => setDeleteUser({ id: u.id, name: u.name, username: u.username })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kullanıcıyı Düzenle: {editUser?.name}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Ad Soyad</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Rol</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "user"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="user">Kullanıcı</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Durum</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "active"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="passive">Pasif</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Personel No</p>
                <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2 font-mono">
                  {editUser?.personnelNo != null ? `#${editUser.personnelNo}` : "—"}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Değişiklikleri Kaydet</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={open => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Şifre Sıfırla: {resetUser?.name}</DialogTitle></DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <FormField control={resetForm.control} name="newPassword" render={({ field }) => (
                <FormItem><FormLabel>Yeni Şifre</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={resetMutation.isPending}>Şifreyi Sıfırla</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  <strong>{deleteUser?.name}</strong> (@{deleteUser?.username}) ve bu kullanıcıya ait tüm veriler kalıcı olarak silinecek:
                </p>
                <ul className="mt-2 list-disc list-inside space-y-0.5 text-sm">
                  <li>Tüm günlük raporlar ve reel kayıtları</li>
                  <li>Tüm Instagram hesapları</li>
                  <li>Cüzdan adresi ve değişiklik geçmişi</li>
                  <li>Gecikme bayrakları</li>
                </ul>
                <p className="mt-2 font-medium text-destructive">Bu işlem geri alınamaz.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
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
