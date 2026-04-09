import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useResetUserPassword, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserStatusBadge } from "@/components/status-badges";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Key, UserX, UserCheck, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().default("user"),
  personnelNo: z.preprocess(v => v === "" ? null : Number(v), z.number().int().min(300).max(2000).nullable().optional()),
});

const editUserSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  personnelNo: z.preprocess(v => v === "" ? null : Number(v), z.number().int().min(300).max(2000).nullable().optional()),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Must be at least 6 characters"),
});

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<{ id: number; name: string; username: string; role: string; status: string; personnelNo?: number | null } | null>(null);
  const [resetUser, setResetUser] = useState<{ id: number; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useListUsers({});
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const resetMutation = useResetUserPassword();

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
        toast({ title: "User created" });
        setCreateOpen(false);
        createForm.reset();
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function onEditSubmit(values: z.infer<typeof editUserSchema>) {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data: values }, {
      onSuccess: () => {
        toast({ title: "User updated" });
        setEditUser(null);
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function onResetSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!resetUser) return;
    resetMutation.mutate({ id: resetUser.id, data: values }, {
      onSuccess: () => {
        toast({ title: "Password reset" });
        setResetUser(null);
        resetForm.reset();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function toggleStatus(user: typeof users extends (infer T)[] | undefined ? T : never) {
    updateMutation.mutate({ id: user.id, data: { status: user.status === "active" ? "passive" : "active" } }, {
      onSuccess: () => {
        toast({ title: `User ${user.status === "active" ? "deactivated" : "activated"}` });
        invalidate();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">{users?.length ?? 0} total users</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? "user"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="personnelNo" render={({ field }) => (
                  <FormItem><FormLabel>Personnel Number (300-2000)</FormLabel><FormControl><Input type="number" placeholder="e.g. 347" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create User</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Personnel #</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
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
                      No users found
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
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3"><UserStatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditUser(u);
                            editForm.reset({ name: u.name, status: u.status, role: u.role, personnelNo: u.personnelNo });
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetUser({ id: u.id, name: u.name })}>
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(u)}>
                            {u.status === "active" ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
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

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User: {editUser?.name}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "user"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "active"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="passive">Passive</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="personnelNo" render={({ field }) => (
                <FormItem><FormLabel>Personnel Number (300-2000)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g. 347" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value)} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Save Changes</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={open => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password: {resetUser?.name}</DialogTitle></DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <FormField control={resetForm.control} name="newPassword" render={({ field }) => (
                <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={resetMutation.isPending}>Reset Password</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
