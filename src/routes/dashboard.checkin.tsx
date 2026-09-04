import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatFridayDate } from "@/lib/services";
import { CalendarDays, UserCheck, Search, HeartHandshake, Loader2, Trash2, Plus, MessageCircle, Phone, ListChecks, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/checkin")({
  component: CheckinHub,
});

function CheckinHub() {
  const { isStaff } = useAuth();

  if (!isStaff) {
    return (
      <AppShell title="تسجيل حضوري">
        <SelfCheckinTab />
      </AppShell>
    );
  }

  return (
    <AppShell title="الحضور والافتقاد" isAdmin>
      <Tabs defaultValue="dates">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="dates">القداسات</TabsTrigger>
          <TabsTrigger value="stats">المواظبة</TabsTrigger>
          <TabsTrigger value="visits">الافتقاد</TabsTrigger>
        </TabsList>
        <TabsContent value="dates" className="mt-3"><DatesTab /></TabsContent>
        <TabsContent value="stats" className="mt-3"><StatsTab /></TabsContent>
        <TabsContent value="visits" className="mt-3"><VisitsTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SelfCheckinTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["self-checkin", user?.id],
    queryFn: async () => {
      const [{ data: schedules }, { data: checkins }] = await Promise.all([
        db.from("schedules").select("id, friday_date, status").eq("status", "published")
          .order("friday_date", { ascending: false }).limit(20),
        db.from("attendance_checkins").select("*").eq("user_id", user!.id),
      ]);
      const map = new Map((checkins ?? []).map((c: any) => [c.schedule_id, c]));
      return { rows: ((schedules ?? []) as any[]).map((s) => ({ ...s, c: map.get(s.id) as any })) };
    },
    enabled: !!user?.id,
  });

  async function report(scheduleId: string, present: boolean, existing: any) {
    if (existing && !existing.self_reported) {
      return toast.info("تم تسجيل حضورك بواسطة الخادم، لا يمكن تعديله");
    }
    if (existing?.confirmed_by) {
      return toast.info("تم تأكيد التسجيل من الخادم، لا يمكن تعديله");
    }
    const { error } = await db.from("attendance_checkins").upsert({
      schedule_id: scheduleId,
      user_id: user!.id,
      present,
      self_reported: true,
      checked_by: user!.id,
      checked_at: new Date().toISOString(),
    }, { onConflict: "schedule_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success(present ? "تم تسجيل حضورك، بانتظار تأكيد الخادم" : "تم تسجيل عدم حضورك");
    qc.invalidateQueries({ queryKey: ["self-checkin"] });
  }

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-2">
      <Card className="p-3 text-xs text-muted-foreground">
        بعد القداس سجّل حضورك بنفسك، ثم يقوم الخادم بتأكيد التسجيل.
      </Card>
      {(data?.rows ?? []).map((r: any) => {
        const c = r.c;
        const locked = c && (!c.self_reported || c.confirmed_by);
        return (
          <Card key={r.id} className="p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">{formatFridayDate(r.friday_date)}</span>
              {c && (
                c.confirmed_by ? (
                  <Badge className="bg-success text-success-foreground gap-1"><Check className="h-3 w-3" />مؤكَّد</Badge>
                ) : (
                  <Badge variant="secondary">بانتظار التأكيد</Badge>
                )
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="sm" disabled={!!locked}
                variant={c?.present ? "default" : "outline"}
                className={c?.present ? "bg-success text-success-foreground h-9" : "h-9"}
                onClick={() => report(r.id, true, c)}>
                <Check className="h-4 w-4 ml-1" />حضرت
              </Button>
              <Button size="sm" disabled={!!locked}
                variant={c && !c.present ? "destructive" : "outline"} className="h-9"
                onClick={() => report(r.id, false, c)}>
                <X className="h-4 w-4 ml-1" />لم أحضر
              </Button>
            </div>
          </Card>
        );
      })}
      {data && data.rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد قداسات منشورة</Card>
      )}
    </div>
  );
}

function DatesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["checkin-schedules"],
    queryFn: async () => {
      const { data } = await db.from("schedules").select("*").order("friday_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-1">اختر تاريخ القداس لتسجيل حضور الشمامسة</p>
      {(data ?? []).map((s) => (
        <Card key={s.id} className="p-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary shrink-0" />
          <span className="font-medium flex-1 truncate">{formatFridayDate(s.friday_date)}</span>
          <Link to="/admin/schedule/$id/checkin" params={{ id: s.id }}>
            <Button size="sm" className="gap-1"><UserCheck className="h-4 w-4" />تسجيل</Button>
          </Link>
        </Card>
      ))}
      {data && data.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد قداسات بعد</Card>
      )}
    </div>
  );
}

function StatsTab() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [detailFor, setDetailFor] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-stats"],
    queryFn: async () => {
      const [{ data: members }, { data: schedules }, { data: checkins }] = await Promise.all([
        db.from("profiles")
          .select("id, full_name, profile_image_url, phone, whatsapp, user_roles!user_roles_user_id_fkey(role)")
          .eq("status", "approved")
          .order("full_name"),
        db.from("schedules").select("id, friday_date"),
        db.from("attendance_checkins").select("user_id, present, schedule_id"),
      ]);
      const deaconsOnly = (members ?? []).filter((m: any) => {
        const roles = (m.user_roles ?? []).map((r: any) => r.role);
        return roles.includes("deacon") && !roles.includes("admin") && !roles.includes("servant");
      });
      return {
        members: deaconsOnly as any[],
        totalMasses: (schedules ?? []).length,
        checkins: (checkins ?? []) as any[],
      };
    },
  });

  const stats = useMemo(() => {
    if (!data) return [];
    const byUser = new Map<string, { present: number; absent: number }>();
    for (const c of data.checkins) {
      const s = byUser.get(c.user_id) ?? { present: 0, absent: 0 };
      if (c.present) s.present++; else s.absent++;
      byUser.set(c.user_id, s);
    }
    const q = search.trim().toLowerCase();
    return data.members
      .filter((m) => !q || m.full_name?.toLowerCase().includes(q))
      .map((m) => {
        const s = byUser.get(m.id) ?? { present: 0, absent: 0 };
        const recorded = s.present + s.absent;
        const pct = recorded === 0 ? 0 : Math.round((s.present / recorded) * 100);
        return { ...m, ...s, recorded, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [data, search]);

  if (isLoading) return <Loader />;

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ابحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
      </div>
      <p className="text-xs text-muted-foreground mb-2">إجمالي القداسات المسجّلة: {data?.totalMasses ?? 0}</p>
      <div className="space-y-2">
        {stats.map((m) => (
          <Card key={m.id} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold shrink-0">
                {m.profile_image_url ? <img src={m.profile_image_url} className="h-full w-full object-cover" /> : m.full_name?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{m.full_name}</p>
                <p className="text-[11px] text-muted-foreground">حاضر {m.present} • غائب {m.absent} • من أصل {m.recorded}</p>
              </div>
              <Badge className={m.pct >= 75 ? "bg-success text-success-foreground" : m.pct >= 50 ? "" : "bg-destructive text-destructive-foreground"}>
                {m.pct}%
              </Badge>
            </div>
            <Progress value={m.pct} className="h-2" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(m.whatsapp || m.phone) && (
                  <a href={`https://wa.me/${whatsappDigits(m.whatsapp || m.phone)}`}
                    target="_blank" rel="noopener"
                    className="h-8 w-8 grid place-items-center rounded-md bg-success/10 text-success hover:bg-success/20" aria-label="واتساب">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {(m.phone || m.whatsapp) && (
                  <a href={`tel:${String(m.phone || m.whatsapp).replace(/[^\d+]/g, "")}`}
                    className="h-8 w-8 grid place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20" aria-label="اتصال">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => setDetailFor({ id: m.id, name: m.full_name })}>
                  <ListChecks className="h-4 w-4" />تفاصيل
                </Button>
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => setSelected({ id: m.id, name: m.full_name })}>
                  <HeartHandshake className="h-4 w-4" />افتقاد
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {stats.length === 0 && <Card className="p-6 text-center text-xs text-muted-foreground">لا توجد بيانات</Card>}
      </div>
      <VisitDialog deacon={selected} onClose={() => setSelected(null)} />
      <AttendanceDetailDialog deacon={detailFor} onClose={() => setDetailFor(null)} />
    </>
  );
}

function AttendanceDetailDialog({ deacon, onClose }: { deacon: { id: string; name: string } | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-detail", deacon?.id],
    queryFn: async () => {
      const [{ data: schedules }, { data: checkins }] = await Promise.all([
        db.from("schedules").select("id, friday_date").order("friday_date", { ascending: false }),
        db.from("attendance_checkins").select("schedule_id, present, note, checked_at").eq("user_id", deacon!.id),
      ]);
      const map = new Map((checkins ?? []).map((c: any) => [c.schedule_id, c]));
      const rows = (schedules ?? []).map((s: any) => ({ ...s, c: map.get(s.id) as any }));
      const present = rows.filter((r: any) => r.c?.present).length;
      const absent = rows.filter((r: any) => r.c && !r.c.present).length;
      const unmarked = rows.length - present - absent;
      return { rows, present, absent, unmarked, total: rows.length };
    },
    enabled: !!deacon?.id,
  });

  return (
    <Dialog open={!!deacon} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>سِجل الحضور — {deacon?.name}</DialogTitle></DialogHeader>
        {isLoading || !data ? <Loader /> : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
              <div className="rounded-md bg-success/10 text-success p-2">
                <p className="font-bold text-lg">{data.present}</p>
                <p>حضور</p>
              </div>
              <div className="rounded-md bg-destructive/10 text-destructive p-2">
                <p className="font-bold text-lg">{data.absent}</p>
                <p>غياب</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="font-bold text-lg">{data.unmarked}</p>
                <p>لم يُسجّل</p>
              </div>
            </div>
            <div className="space-y-1">
              {data.rows.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 border rounded p-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1">{formatFridayDate(r.friday_date)}</span>
                  {r.c ? (
                    r.c.present ? (
                      <Badge className="bg-success text-success-foreground gap-1"><Check className="h-3 w-3" />حاضر</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />غائب</Badge>
                    )
                  ) : (
                    <Badge variant="secondary">—</Badge>
                  )}
                </div>
              ))}
              {data.rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد قداسات</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VisitsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-visitations"],
    queryFn: async () => {
      const { data } = await db.from("visitations")
        .select("*, deacon:profiles!visitations_deacon_id_fkey(id,full_name,profile_image_url), by:profiles!visitations_by_user_id_fkey(full_name)")
        .order("visited_at", { ascending: false })
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((v) => !q || v.deacon?.full_name?.toLowerCase().includes(q));
  }, [data, search]);

  async function del(id: string) {
    if (!confirm("حذف هذا الافتقاد؟")) return;
    const { error } = await db.from("visitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["all-visitations"] });
  }

  if (isLoading) return <Loader />;

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ابحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
      </div>
      <div className="space-y-2">
        {filtered.map((v) => (
          <Card key={v.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold shrink-0">
                {v.deacon?.profile_image_url ? <img src={v.deacon.profile_image_url} className="h-full w-full object-cover" /> : v.deacon?.full_name?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{v.deacon?.full_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  بواسطة {v.by?.full_name ?? "—"} • {new Date(v.visited_at).toLocaleDateString("ar-EG")}
                </p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{v.note}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(v.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-6 text-center text-xs text-muted-foreground">لا توجد سجلات افتقاد بعد</Card>}
      </div>
      <Button className="fixed bottom-20 left-4 rounded-full h-12 w-12 p-0 shadow-lg" onClick={() => setSelected({ id: "", name: "" })}>
        <Plus className="h-5 w-5" />
      </Button>
      <VisitDialog deacon={selected} onClose={() => setSelected(null)} pickDeacon={!selected?.id} />
    </>
  );
}

function VisitDialog({ deacon, onClose, pickDeacon }: { deacon: { id: string; name: string } | null; onClose: () => void; pickDeacon?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [deaconId, setDeaconId] = useState<string>("");
  const [deaconSearch, setDeaconSearch] = useState("");

  const { data: history } = useQuery({
    queryKey: ["visitations", deacon?.id],
    queryFn: async () => {
      const { data } = await db.from("visitations")
        .select("*, by:profiles!visitations_by_user_id_fkey(full_name)")
        .eq("deacon_id", deacon!.id)
        .order("visited_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!deacon?.id && !pickDeacon,
  });

  const { data: deacons } = useQuery({
    queryKey: ["deacon-list-for-visit"],
    queryFn: async () => {
      const { data } = await db.from("profiles")
        .select("id, full_name, user_roles!user_roles_user_id_fkey(role)")
        .eq("status", "approved").order("full_name");
      return ((data ?? []) as any[]).filter((m) => {
        const roles = (m.user_roles ?? []).map((r: any) => r.role);
        return roles.includes("deacon") && !roles.includes("admin") && !roles.includes("servant");
      });
    },
    enabled: !!pickDeacon,
  });

  const filteredDeacons = useMemo(() => {
    const q = deaconSearch.trim().toLowerCase();
    return (deacons ?? []).filter((d) => !q || d.full_name?.toLowerCase().includes(q));
  }, [deacons, deaconSearch]);

  async function save() {
    const targetId = pickDeacon ? deaconId : deacon?.id;
    if (!targetId) return toast.error("اختر الشماس");
    if (!note.trim()) return toast.error("اكتب ملاحظة الافتقاد");
    const { error } = await db.from("visitations").insert({
      deacon_id: targetId, by_user_id: user!.id, note: note.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ الافتقاد");
    setNote(""); setDeaconId(""); setDeaconSearch("");
    qc.invalidateQueries({ queryKey: ["visitations"] });
    qc.invalidateQueries({ queryKey: ["all-visitations"] });
    onClose();
  }

  return (
    <Dialog open={!!deacon} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pickDeacon ? "افتقاد جديد" : `افتقاد — ${deacon?.name}`}
          </DialogTitle>
        </DialogHeader>

        {pickDeacon && (
          <div>
            <Input placeholder="ابحث عن الشماس..." value={deaconSearch} onChange={(e) => setDeaconSearch(e.target.value)} className="mb-2" />
            <div className="max-h-40 overflow-y-auto border rounded">
              {filteredDeacons.map((d) => (
                <button key={d.id}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-accent/40 ${deaconId === d.id ? "bg-primary/10 font-semibold" : ""}`}
                  onClick={() => setDeaconId(d.id)}>
                  {d.full_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea placeholder="اكتب ملاحظات الافتقاد (اتصال / زيارة / متابعة...)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24" />

        {!pickDeacon && (
          <div>
            <p className="text-xs font-semibold mb-1">السجل السابق</p>
            {(history ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">لا يوجد افتقاد سابق</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {history!.map((v) => (
                  <div key={v.id} className="text-xs border rounded p-2">
                    <p className="text-muted-foreground">{new Date(v.visited_at).toLocaleDateString("ar-EG")} • {v.by?.full_name}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{v.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Loader() {
  return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
