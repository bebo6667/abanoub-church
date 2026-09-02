import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatFridayDate, SERVICE_LABELS, type ServiceType } from "@/lib/services";
import { Loader2, Check, X, Search, ChevronRight, Save, Phone, MessageCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/schedule/$id/checkin")({
  component: CheckinPage,
});

type Member = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  user_roles?: { role: string }[];
};

function normalizePhone(v?: string | null) {
  if (!v) return null;
  return v.replace(/[^\d+]/g, "");
}

function CheckinPage() {
  const { id } = useParams({ from: "/admin/schedule/$id/checkin" });
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-checkin", id],
    queryFn: async () => {
      const [{ data: schedule }, { data: assignments }, { data: members }, { data: checkins }] = await Promise.all([
        db.from("schedules").select("*").eq("id", id).maybeSingle(),
        db.from("schedule_assignments").select("user_id, service_type").eq("schedule_id", id),
        db.from("profiles")
          .select("id,full_name,profile_image_url,phone,whatsapp,user_roles!user_roles_user_id_fkey(role)")
          .eq("status", "approved")
          .order("full_name"),
        db.from("attendance_checkins").select("*").eq("schedule_id", id),
      ]);
      return {
        schedule,
        assignments: (assignments ?? []) as any[],
        members: (members ?? []) as Member[],
        checkins: (checkins ?? []) as any[],
      };
    },
  });

  const services = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of data?.assignments ?? []) {
      const arr = m.get(a.user_id) ?? [];
      arr.push(SERVICE_LABELS[a.service_type as ServiceType] ?? a.service_type);
      m.set(a.user_id, arr);
    }
    return m;
  }, [data]);

  const checkinMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of data?.checkins ?? []) m.set(c.user_id, c);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.members ?? []).filter((m) => {
      const roles = (m.user_roles ?? []).map((r: any) => r.role);
      const isDeacon = roles.includes("deacon") && !roles.includes("admin") && !roles.includes("servant");
      if (!isDeacon) return false;
      return !q || m.full_name?.toLowerCase().includes(q);
    });
  }, [data, search]);

  const assignedList = filtered.filter((m) => services.has(m.id));
  const othersList = filtered.filter((m) => !services.has(m.id));

  const deaconIds = useMemo(() => new Set(filtered.map((m) => m.id)), [filtered]);
  const deaconCheckins = (data?.checkins ?? []).filter((c) => deaconIds.has(c.user_id));
  const presentCount = deaconCheckins.filter((c) => c.present).length;
  const absentCount = deaconCheckins.filter((c) => !c.present).length;
  const unmarkedCount = filtered.length - presentCount - absentCount;

  async function mark(userId: string, present: boolean, note?: string | null, memberName?: string) {
    const existing = checkinMap.get(userId);
    // Duplicate guard: same status already saved
    if (existing && existing.present === present && note === undefined) {
      toast.info(`تم تسجيل ${present ? "الحضور" : "الغياب"} مسبقاً لهذا الشماس`);
      return;
    }
    // Confirm overwrite when changing status
    if (existing && existing.present !== present && note === undefined) {
      const ok = confirm(`الشماس مسجّل حالياً ${existing.present ? "حاضر" : "غائب"}. هل تريد تغيير الحالة إلى ${present ? "حاضر" : "غائب"}؟`);
      if (!ok) return;
    }
    const payload: any = {
      schedule_id: id,
      user_id: userId,
      present,
      self_reported: false,
      confirmed_by: user!.id,
      confirmed_at: new Date().toISOString(),
      checked_by: user!.id,
      checked_at: new Date().toISOString(),
    };
    if (note !== undefined) payload.note = note;
    else if (existing?.note) payload.note = existing.note;

    const { error } = await db.from("attendance_checkins").upsert(payload, { onConflict: "schedule_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success(`تم حفظ ${present ? "حضور" : "غياب"}${memberName ? ` ${memberName}` : ""} بنجاح`);
    qc.invalidateQueries({ queryKey: ["schedule-checkin", id] });
    qc.invalidateQueries({ queryKey: ["attendance-stats"] });
  }

  async function clearMark(userId: string) {
    const { error } = await db.from("attendance_checkins").delete().eq("schedule_id", id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("تم مسح التسجيل");
    qc.invalidateQueries({ queryKey: ["schedule-checkin", id] });
    qc.invalidateQueries({ queryKey: ["attendance-stats"] });
  }

  if (!isStaff) {
    return <AppShell title="تسجيل الحضور"><Card className="p-6 text-center text-sm text-muted-foreground">هذه الصفحة للخدام والأدمن فقط</Card></AppShell>;
  }

  if (isLoading || !data?.schedule) {
    return <AppShell title="تسجيل الحضور" isAdmin><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  const Row = ({ m }: { m: Member }) => {
    const c = checkinMap.get(m.id);
    const svc = services.get(m.id);
    const editing = noteFor === m.id;
    const wa = normalizePhone(m.whatsapp || m.phone);
    const tel = normalizePhone(m.phone || m.whatsapp);
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold shrink-0">
            {m.profile_image_url ? <img src={m.profile_image_url} className="h-full w-full object-cover" /> : m.full_name?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{m.full_name}</p>
            {svc && <p className="text-[11px] text-muted-foreground truncate">{svc.join("، ")}</p>}
            {c?.note && !editing && <p className="text-[11px] mt-0.5 text-primary">📝 {c.note}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {wa && (
              <a href={`https://wa.me/${wa.replace(/^\+/, "")}`} target="_blank" rel="noopener"
                className="h-8 w-8 grid place-items-center rounded-md bg-success/10 text-success hover:bg-success/20" aria-label="واتساب">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {tel && (
              <a href={`tel:${tel}`} className="h-8 w-8 grid place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20" aria-label="اتصال">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button size="sm" variant={c?.present ? "default" : "outline"}
            className={c?.present ? "bg-success text-success-foreground h-9" : "h-9"}
            onClick={() => mark(m.id, true, undefined, m.full_name)}>
            <Check className="h-4 w-4 ml-1" />حاضر
          </Button>
          <Button size="sm" variant={c && !c.present ? "destructive" : "outline"} className="h-9"
            onClick={() => mark(m.id, false, undefined, m.full_name)}>
            <X className="h-4 w-4 ml-1" />غائب
          </Button>
        </div>
        {editing ? (
          <div className="mt-2 flex gap-2">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="ملاحظة (اختياري)" className="min-h-16" />
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={async () => { await mark(m.id, c?.present ?? true, noteText || null); setNoteFor(null); }}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>إلغاء</Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <button className="text-muted-foreground underline" onClick={() => { setNoteFor(m.id); setNoteText(c?.note ?? ""); }}>
              {c?.note ? "تعديل الملاحظة" : "إضافة ملاحظة"}
            </button>
            {c && (
              <button className="text-destructive underline" onClick={() => clearMark(m.id)}>مسح التسجيل</button>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <AppShell title="تسجيل الحضور" isAdmin>
      <Card className="p-4 mb-3 gradient-sacred text-primary-foreground">
        <div className="flex items-center gap-2 text-xs opacity-90">
          <Link to="/admin/schedule/$id" params={{ id }} className="flex items-center gap-1 hover:underline">
            <ChevronRight className="h-3 w-3" />رجوع للجدول
          </Link>
        </div>
        <h2 className="text-lg font-bold mt-1">تسجيل حضور الشمامسة — {formatFridayDate(data.schedule.friday_date)}</h2>
        <div className="flex gap-2 mt-2">
          <Badge className="bg-success text-success-foreground">حاضر: {presentCount}</Badge>
          <Badge variant="destructive">غائب: {absentCount}</Badge>
          <Badge variant="secondary">لم يُسجّل: {unmarkedCount}</Badge>
        </div>
        <div className="mt-2">
          <Link to="/dashboard/checkin" className="text-xs underline flex items-center gap-1 opacity-90">
            <BarChart3 className="h-3 w-3" />عرض نِسَب المواظبة لكل شماس
          </Link>
        </div>
      </Card>

      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ابحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
      </div>

      <Tabs defaultValue="assigned">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="assigned">المسندون ({assignedList.length})</TabsTrigger>
          <TabsTrigger value="others">أعضاء آخرون ({othersList.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="assigned" className="space-y-2 mt-3">
          {assignedList.length === 0 && <Card className="p-4 text-center text-xs text-muted-foreground">لا يوجد مسندون</Card>}
          {assignedList.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="others" className="space-y-2 mt-3">
          {othersList.length === 0 && <Card className="p-4 text-center text-xs text-muted-foreground">لا يوجد</Card>}
          {othersList.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
