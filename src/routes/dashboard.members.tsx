import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
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
  STATUS_LABELS, RANK_LABELS, RANK_ORDER, EDUCATION_LABELS, EDUCATION_ORDER,
  normalizeWhatsapp, whatsappDigits, formatDate, mapsUrl,
} from "@/lib/services";
import { toast } from "sonner";
import { Phone, MessageCircle, Check, X, Search, Shield, MapPin, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/dashboard/members")({
  component: MembersPage,
});

type Row = any;

function MembersPage() {
  const { loading, session, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"approved" | "pending" | "rejected" | "all">("approved");
  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveFor, setApproveFor] = useState<Row | null>(null);
  const [approveRole, setApproveRole] = useState<"deacon" | "servant" | "admin">("deacon");
  const [changeRoleFor, setChangeRoleFor] = useState<Row | null>(null);
  const [newRole, setNewRole] = useState<"deacon" | "servant" | "admin">("deacon");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (profile?.status !== "approved") navigate({ to: "/pending", replace: true });
  }, [loading, session, profile, navigate]);

  const effectiveTab = isAdmin ? tab : "approved";

  const { data: users } = useQuery({
    queryKey: ["members", effectiveTab],
    queryFn: async () => {
      const query = db.from("profiles").select("*, user_roles!user_roles_user_id_fkey(role)");
      if (effectiveTab !== "all") query.eq("status", effectiveTab);
      const { data } = await query;
      return (data ?? []) as Row[];
    },
    enabled: !!profile && profile.status === "approved",
  });

  const byId = useMemo(() => {
    const m = new Map<string, Row>();
    (users ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const groups = useMemo(() => {
    const get = (u: Row) => u.user_roles?.[0]?.role;
    const list = users ?? [];
    return {
      admins: list.filter((u) => get(u) === "admin"),
      servants: list.filter((u) => get(u) === "servant"),
      deacons: list.filter((u) => get(u) === "deacon"),
      others: list.filter((u) => !["admin", "servant", "deacon"].includes(get(u))),
    };
  }, [users]);

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
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["pending-count"] });
    toast.success("تمت الموافقة");
  }

  async function changeRole() {
    if (!changeRoleFor) return;
    await db.from("user_roles").delete().eq("user_id", changeRoleFor.id);
    const { error } = await db.from("user_roles").insert({ user_id: changeRoleFor.id, role: newRole });
    if (error) return toast.error(error.message);
    setChangeRoleFor(null);
    qc.invalidateQueries({ queryKey: ["members"] });
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
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["pending-count"] });
    toast.success("تم الرفض");
  }

  if (loading || !profile) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <AppShell title="الأعضاء" isAdmin={isAdmin}>
      {isAdmin && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pending">معلق</TabsTrigger>
            <TabsTrigger value="approved">مقبول</TabsTrigger>
            <TabsTrigger value="rejected">مرفوض</TabsTrigger>
            <TabsTrigger value="all">الكل</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="space-y-6">
        <SectionTable
          title="الخدام الرئيسيون (أدمن)"
          icon={<Shield className="h-4 w-4 text-primary" />}
          rows={groups.admins}
          isAdmin={isAdmin}
          showLinkedServant={false}
          onApprove={(u) => { setApproveFor(u); setApproveRole("admin"); }}
          onReject={(u) => setRejectFor(u)}
          onChangeRole={(u) => { setChangeRoleFor(u); setNewRole("admin"); }}
        />
        <SectionTable
          title="الخدام"
          rows={groups.servants}
          isAdmin={isAdmin}
          showLinkedServant={false}
          onApprove={(u) => { setApproveFor(u); setApproveRole("servant"); }}
          onReject={(u) => setRejectFor(u)}
          onChangeRole={(u) => { setChangeRoleFor(u); setNewRole("servant"); }}
        />
        <SectionTable
          title="الشمامسة"
          rows={groups.deacons}
          isAdmin={isAdmin}
          showLinkedServant
          byId={byId}
          onApprove={(u) => { setApproveFor(u); setApproveRole("deacon"); }}
          onReject={(u) => setRejectFor(u)}
          onChangeRole={(u) => { setChangeRoleFor(u); setNewRole("deacon"); }}
        />
        {isAdmin && groups.others.length > 0 && (
          <SectionTable
            title="بدون دور / قيد المراجعة"
            rows={groups.others}
            isAdmin={isAdmin}
            showLinkedServant={false}
            onApprove={(u) => { setApproveFor(u); setApproveRole(u.requested_role === "servant" ? "servant" : "deacon"); }}
            onReject={(u) => setRejectFor(u)}
            onChangeRole={(u) => { setChangeRoleFor(u); setNewRole("deacon"); }}
          />
        )}
      </div>

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

function ContactButtons({ u }: { u: Row }) {
  const waNumber = normalizeWhatsapp(u?.whatsapp);
  const waDigits = whatsappDigits(u?.whatsapp);
  const callNumber = u?.phone || waNumber;
  return (
    <div className="flex items-center gap-1">
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
  );
}

function SectionTable({
  title, icon, rows, isAdmin, showLinkedServant, byId,
  onApprove, onReject, onChangeRole,
}: {
  title: string;
  icon?: React.ReactNode;
  rows: Row[];
  isAdmin: boolean;
  showLinkedServant?: boolean;
  byId?: Map<string, Row>;
  onApprove: (u: Row) => void;
  onReject: (u: Row) => void;
  onChangeRole: (u: Row) => void;
}) {
  const [q, setQ] = useState("");
  const [rankF, setRankF] = useState<string>("all");
  const [eduF, setEduF] = useState<string>("all");
  const [confF, setConfF] = useState<"all" | "recent" | "stale" | "missing">("all");

  const filtered = useMemo(() => {
    return rows.filter((u) => {
      if (q && !(u.full_name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()))) return false;
      if (rankF !== "all" && u.rank !== rankF) return false;
      if (eduF !== "all" && u.education_stage !== eduF) return false;
      if (confF !== "all") {
        const d = u.last_confession_date ? new Date(u.last_confession_date) : null;
        if (confF === "missing") { if (d) return false; }
        else {
          if (!d) return false;
          const days = (Date.now() - d.getTime()) / 86400000;
          if (confF === "recent" && days > 40) return false;
          if (confF === "stale" && days <= 40) return false;
        }
      }
      return true;
    });
  }, [rows, q, rankF, eduF, confF]);

  const colCount = 10 + (showLinkedServant ? 1 : 0) + (isAdmin ? 1 : 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon}
        <h2 className="font-bold text-sm">{title}</h2>
        <Badge variant="outline" className="text-[10px]">{filtered.length}/{rows.length}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم..." className="pr-8 h-8 text-xs" />
        </div>
        <Select value={rankF} onValueChange={setRankF}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="الرتبة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الرتب</SelectItem>
            {RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{RANK_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={eduF} onValueChange={setEduF}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="المرحلة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المراحل</SelectItem>
            {EDUCATION_ORDER.map((s) => <SelectItem key={s} value={s}>{EDUCATION_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={confF} onValueChange={(v: any) => setConfF(v)}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="الاعتراف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">آخر اعتراف: الكل</SelectItem>
            <SelectItem value="recent">حديث (≤40 يوم)</SelectItem>
            <SelectItem value="stale">قديم (&gt;40 يوم)</SelectItem>
            <SelectItem value="missing">غير مسجل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm border-collapse min-w-[1100px]">
          <thead className="bg-secondary/50">
            <tr className="text-right">
              <th className="p-2 font-semibold">الصورة</th>
              <th className="p-2 font-semibold">الاسم</th>
              <th className="p-2 font-semibold">الرتبة</th>
              <th className="p-2 font-semibold">المرحلة</th>
              <th className="p-2 font-semibold">السن</th>
              <th className="p-2 font-semibold">تاريخ الميلاد</th>
              <th className="p-2 font-semibold">آخر اعتراف</th>
              <th className="p-2 font-semibold">العنوان</th>
              <th className="p-2 font-semibold">الهاتف</th>
              <th className="p-2 font-semibold text-center">تواصل</th>
              {showLinkedServant && <th className="p-2 font-semibold">الخادم المسؤول</th>}
              {isAdmin && <th className="p-2 font-semibold text-center">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const waNumber = normalizeWhatsapp(u.whatsapp);
              const map = mapsUrl(u.home_latitude, u.home_longitude);
              const servant = showLinkedServant && u.linked_servant_id ? byId?.get(u.linked_servant_id) : null;
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
                    {u.email && <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{u.email}</p>}
                    {u.status !== "approved" && (
                      <Badge variant="outline" className="text-[10px] mt-1">{STATUS_LABELS[u.status]}</Badge>
                    )}
                    {u.rejection_reason && <p className="text-[11px] text-destructive mt-1">رفض: {u.rejection_reason}</p>}
                  </td>
                  <td className="p-2 whitespace-nowrap">{u.rank ? RANK_LABELS[u.rank as keyof typeof RANK_LABELS] : "—"}</td>
                  <td className="p-2 whitespace-nowrap">{u.education_stage ? EDUCATION_LABELS[u.education_stage as keyof typeof EDUCATION_LABELS] : "—"}</td>
                  <td className="p-2">{u.age ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(u.date_of_birth)}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(u.last_confession_date)}</td>
                  <td className="p-2 max-w-[200px]">
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{u.address || "—"}</span>
                      {map && (
                        <a href={map} target="_blank" rel="noopener noreferrer" title="فتح الخريطة">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary">
                            <MapPin className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap" dir="ltr">
                    {waNumber || "—"}
                    {u.phone && <div className="text-[11px] text-muted-foreground">{u.phone}</div>}
                  </td>
                  <td className="p-2">
                    <ContactButtons u={u} />
                  </td>
                  {showLinkedServant && (
                    <td className="p-2 min-w-[160px]">
                      {servant ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-secondary overflow-hidden grid place-items-center text-[11px] font-semibold shrink-0">
                            {servant.profile_image_url
                              ? <img src={servant.profile_image_url} className="h-full w-full object-cover" alt="" />
                              : servant.full_name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{servant.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {servant.rank ? RANK_LABELS[servant.rank as keyof typeof RANK_LABELS] : "خادم"}
                            </p>
                          </div>
                          <ContactButtons u={servant} />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  )}
                  {isAdmin && (
                    <td className="p-2">
                      {u.status === "pending" ? (
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" className="h-8 bg-success text-success-foreground hover:opacity-90"
                            onClick={() => onApprove(u)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => onReject(u)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : u.status === "approved" ? (
                        <Button size="sm" variant="outline" className="h-8 whitespace-nowrap"
                          onClick={() => onChangeRole(u)}>
                          تغيير الدور
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8"
                          onClick={() => onApprove(u)}>
                          إعادة قبول
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={colCount} className="p-6 text-center text-sm text-muted-foreground">لا يوجد</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
