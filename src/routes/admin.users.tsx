import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ROLE_LABELS, STATUS_LABELS, normalizeWhatsapp, whatsappDigits, formatDate,
} from "@/lib/services";
import { toast } from "sonner";
import { Phone, MessageCircle, Check, X, Search, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("approved");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [rejectFor, setRejectFor] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveFor, setApproveFor] = useState<any>(null);
  const [approveRole, setApproveRole] = useState<"deacon" | "servant" | "admin">("deacon");
  const [changeRoleFor, setChangeRoleFor] = useState<any>(null);
  const [newRole, setNewRole] = useState<"deacon" | "servant" | "admin">("deacon");

  const { data: users } = useQuery({
    queryKey: ["admin-users", tab],
    queryFn: async () => {
      const query = db.from("profiles").select("*, user_roles!user_roles_user_id_fkey(role)");
      if (tab !== "all") query.eq("status", tab);
      const { data } = await query;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    let list = (users ?? []).filter((u) =>
      !q || u.full_name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase())
    );
    if (sort === "name") list = [...list].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "ar"));
    else if (sort === "age") list = [...list].sort((a, b) => (a.age || 0) - (b.age || 0));
    return list;
  }, [users, q, sort]);

  async function approve() {
    if (!approveFor) return;
    const { error: e1 } = await db.from("profiles").update({
      status: "approved", rejection_reason: null,
    }).eq("id", approveFor.id);
    if (e1) return toast.error(e1.message);
    await db.from("user_roles").delete().eq("user_id", approveFor.id);
    const { error: e2 } = await db.from("user_roles").insert({ user_id: approveFor.id, role: approveRole });
    if (e2) return toast.error(e2.message);
    setApproveFor(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["pending-count"] });
    toast.success("تمت الموافقة");
  }

  async function changeRole() {
    if (!changeRoleFor) return;
    await db.from("user_roles").delete().eq("user_id", changeRoleFor.id);
    const { error } = await db.from("user_roles").insert({ user_id: changeRoleFor.id, role: newRole });
    if (error) return toast.error(error.message);
    setChangeRoleFor(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success("تم تغيير الدور");
  }

  async function reject() {
    if (!rejectFor) return;
    if (!rejectReason.trim()) return toast.error("اكتب سبب الرفض");
    const { error } = await db.from("profiles").update({
      status: "rejected", rejection_reason: rejectReason,
    }).eq("id", rejectFor.id);
    if (error) return toast.error(error.message);
    setRejectFor(null); setRejectReason("");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["pending-count"] });
    toast.success("تم الرفض");
  }

  return (
    <AppShell title="الأعضاء" isAdmin>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="pending">معلق</TabsTrigger>
          <TabsTrigger value="approved">مقبول</TabsTrigger>
          <TabsTrigger value="rejected">مرفوض</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 my-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم..." className="pr-8" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">أبجدي</SelectItem>
            <SelectItem value="age">العمر</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="bg-secondary/50">
            <tr className="text-right">
              <th className="p-2 font-semibold">الصورة</th>
              <th className="p-2 font-semibold">الاسم</th>
              <th className="p-2 font-semibold">الدور / الحالة</th>
              <th className="p-2 font-semibold">السن</th>
              <th className="p-2 font-semibold">تاريخ الميلاد</th>
              <th className="p-2 font-semibold">العنوان</th>
              <th className="p-2 font-semibold">رقم الهاتف</th>
              <th className="p-2 font-semibold text-center">تواصل</th>
              <th className="p-2 font-semibold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const role = u.user_roles?.[0]?.role;
              const waNumber = normalizeWhatsapp(u.whatsapp);
              const waDigits = whatsappDigits(u.whatsapp);
              const callNumber = u.phone || waNumber;
              return (
                <tr key={u.id} className="border-t align-middle">
                  <td className="p-2">
                    <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden grid place-items-center font-semibold">
                      {u.profile_image_url
                        ? <img src={u.profile_image_url} className="h-full w-full object-cover" alt="" />
                        : u.full_name?.charAt(0)}
                    </div>
                  </td>
                  <td className="p-2 min-w-[140px]">
                    <p className="font-semibold leading-tight">{u.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{u.email}</p>
                    {u.church_name && <p className="text-[11px] text-muted-foreground">{u.church_name}</p>}
                    {u.rejection_reason && <p className="text-[11px] text-destructive mt-1">رفض: {u.rejection_reason}</p>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[10px] w-fit">{STATUS_LABELS[u.status]}</Badge>
                      {role && (
                        <Badge className={`text-[10px] w-fit ${role === "admin" ? "bg-gold text-foreground" : ""}`}>
                          {role === "admin" && <Shield className="h-3 w-3 ml-0.5" />}
                          {ROLE_LABELS[role]}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-2">{u.age ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(u.date_of_birth)}</td>
                  <td className="p-2 max-w-[180px]">
                    <span className="text-xs">{u.address || "—"}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap" dir="ltr">
                    {waNumber || "—"}
                    {u.phone && <div className="text-[11px] text-muted-foreground">{u.phone}</div>}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-1">
                      {waDigits && (
                        <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-success" title="واتساب">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {callNumber && (
                        <a href={`tel:${callNumber}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="اتصال">
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    {u.status === "pending" ? (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" className="h-8 bg-success text-success-foreground hover:opacity-90"
                          onClick={() => { setApproveFor(u); setApproveRole(u.requested_role === "servant" ? "servant" : "deacon"); }}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setRejectFor(u)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : u.status === "approved" ? (
                      <Button size="sm" variant="outline" className="h-8 whitespace-nowrap"
                        onClick={() => { setChangeRoleFor(u); setNewRole((role as any) || "deacon"); }}>
                        تغيير الدور
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8"
                        onClick={() => { setApproveFor(u); setApproveRole("deacon"); }}>
                        إعادة قبول
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">لا توجد نتائج</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!approveFor} onOpenChange={(v) => !v && setApproveFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعيين دور لـ {approveFor?.full_name}</DialogTitle></DialogHeader>
          <Select value={approveRole} onValueChange={(v: any) => setApproveRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deacon">شماس</SelectItem>
              <SelectItem value="servant">خادم</SelectItem>
              <SelectItem value="admin">أدمن</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveFor(null)}>إلغاء</Button>
            <Button onClick={approve}>تأكيد الموافقة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!changeRoleFor} onOpenChange={(v) => !v && setChangeRoleFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تغيير دور {changeRoleFor?.full_name}</DialogTitle></DialogHeader>
          <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deacon">شماس</SelectItem>
              <SelectItem value="servant">خادم</SelectItem>
              <SelectItem value="admin">أدمن</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeRoleFor(null)}>إلغاء</Button>
            <Button onClick={changeRole}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={(v) => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>سبب رفض {rejectFor?.full_name}</DialogTitle></DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="السبب..." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectFor(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={reject}>رفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
