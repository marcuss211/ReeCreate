import { useState } from "react";
import { useListInstagramAccounts, useCreateInstagramAccount, useUpdateInstagramAccount, useListUsers, getListInstagramAccountsQueryKey } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Instagram, AtSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const createSchema = z.object({
  userId: z.coerce.number().int().positive("Select a user"),
  instagramUsername: z.string().min(1, "Username is required").regex(/^[a-zA-Z0-9._]+$/, "Invalid Instagram username"),
  profileUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
});

const editSchema = z.object({
  instagramUsername: z.string().min(1).optional(),
  profileUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  status: z.string().optional(),
});

export default function AdminAccounts() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useListInstagramAccounts({});
  const { data: users } = useListUsers({ status: "active" });
  const createMutation = useCreateInstagramAccount();
  const updateMutation = useUpdateInstagramAccount();

  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });

  const filtered = (accounts ?? []).filter(a =>
    a.instagramUsername.toLowerCase().includes(search.toLowerCase()) ||
    (a.userName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListInstagramAccountsQueryKey({}) });

  function onCreateSubmit(values: z.infer<typeof createSchema>) {
    createMutation.mutate({ data: { ...values, profileUrl: values.profileUrl || null, description: values.description || null } }, {
      onSuccess: () => {
        toast({ title: "Account created" });
        setCreateOpen(false);
        createForm.reset();
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function onEditSubmit(values: z.infer<typeof editSchema>) {
    if (!editAccount) return;
    updateMutation.mutate({ id: editAccount.id, data: { ...values, profileUrl: values.profileUrl || null } }, {
      onSuccess: () => {
        toast({ title: "Account updated" });
        setEditAccount(null);
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }

  function toggleStatus(account: any) {
    updateMutation.mutate({ id: account.id, data: { status: account.status === "active" ? "passive" : "active" } }, {
      onSuccess: () => {
        toast({ title: `Account ${account.status === "active" ? "deactivated" : "activated"}` });
        invalidate();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instagram Accounts</h1>
          <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} total accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Instagram Account</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="userId" render={({ field }) => (
                  <FormItem><FormLabel>Assign to User</FormLabel>
                    <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value ?? "")}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(users ?? []).map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name} {u.personnelNo ? `(#${u.personnelNo})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="instagramUsername" render={({ field }) => (
                  <FormItem><FormLabel>Instagram Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input className="pl-7" placeholder="username" {...field} />
                      </div>
                    </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="profileUrl" render={({ field }) => (
                  <FormItem><FormLabel>Profile URL (optional)</FormLabel><FormControl><Input placeholder="https://instagram.com/username" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Account</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search accounts or users..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Instagram Account</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assigned To</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      <Instagram className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{a.instagramUsername}</span>
                        </div>
                        {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span>{a.userName ?? "—"}</span>
                        {a.userPersonnelNo && <span className="ml-1.5 text-xs text-muted-foreground">#{a.userPersonnelNo}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-green-100 text-green-800" : ""}>
                          {a.status === "active" ? "Active" : "Passive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditAccount(a);
                            editForm.reset({ instagramUsername: a.instagramUsername, profileUrl: a.profileUrl ?? "", description: a.description ?? "", status: a.status });
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleStatus(a)}>
                            {a.status === "active" ? "Deactivate" : "Activate"}
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

      <Dialog open={!!editAccount} onOpenChange={open => !open && setEditAccount(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account: @{editAccount?.instagramUsername}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="instagramUsername" render={({ field }) => (
                <FormItem><FormLabel>Instagram Username</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="profileUrl" render={({ field }) => (
                <FormItem><FormLabel>Profile URL</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
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
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Save Changes</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
