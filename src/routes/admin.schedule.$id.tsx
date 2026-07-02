import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SERVICE_LABELS, SERVICE_ORDER, MULTI_SELECT_SERVICES,
  formatFridayDate, DECLINE_REASONS, type ServiceType,
} from "@/lib/services";
import { Loader2, UserPlus, Send, Trash2, X, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/schedule/$id")({
  component: AdminScheduleEditor,
});

function AdminScheduleEditor() {
  const { id } = useParams({ from: "/admin/schedule/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pickerFor, setPickerFor] = useState<ServiceType | null>(null);
  const [search, setSearch] = useState("");
  const [tempSel, setTempSel] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-schedule", id],
    queryFn: async () => {
      const [{ data: schedule }, { data: assignments }, { data: deacons }] = await Promise.all([
        db.from("schedules").select("*").eq("id", id).maybeSingle(),
        db.from("schedule_assignments")
          .select("*, profiles!schedule_assignments_user_id_fkey(id,full_name,profile_image_url), attendance_responses!attendance_responses_assignment_id_fkey(status,reason,note)")
          .eq("schedule_id", id),
        db.from("profiles").select("id,full_name,profile_image_url,age,user_roles!user_roles_user_id_fkey(role)").eq("status", "approved"),
      ]);
      return { schedule, assignments: (assignments ?? []) as any[], deacons: (deacons ?? []) as any[] };
    },
  });

  const filteredDeacons = useMemo(() => {
    return (data?.deacons ?? []).filter((d) => !search || d.full_name?.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  if (isLoading || !data?.schedule) {
    return <AppShell title="تحرير الجدول" isAdmin><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  const schedule = data.schedule;
  const isPublished = schedule.status === "published";

  function openPicker(svc: ServiceType) {
    const existing = data!.assignments.filter((a) => a.service_type === svc).map((a) => a.user_id);
    setTempSel(existing);
    setPickerFor(svc);
  }

  async function savePicker() {
    if (!pickerFor) return;
    const isMulti = MULTI_SELECT_SERVICES.includes(pickerFor);
    const final = isMulti ? tempSel : tempSel.slice(0, 1);
    const existing = data!.assignments.filter((a) => a.service_type === pickerFor);
    const existingIds = existing.map((a) => a.user_id);

    const toRemove = existing.filter((a) => !final.includes(a.user_id));
    const toAdd = final.filter((u) => !existingIds.includes(u));

    if (toRemove.length) {
      await db.from("schedule_assignments").delete().in("id", toRemove.map((a) => a.id));
    }
    if (toAdd.length) {
      await db.from("schedule_assignments").insert(toAdd.map((u) => ({
        schedule_id: id, user_id: u, service_type: pickerFor,
      })));
    }
    setPickerFor(null);
    qc.invalidateQueries({ queryKey: ["admin-schedule", id] });
    toast.success("تم الحفظ");
  }

  async function removeAssignment(aid: string) {
    await db.from("schedule_assignments").delete().eq("id", aid);
    qc.invalidateQueries({ queryKey: ["admin-schedule", id] });
  }

  async function publish() {
    const { error } = await db.from("schedules").update({ status: "published" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم النشر");
    qc.invalidateQueries({ queryKey: ["admin-schedule", id] });
  }

  async function unpublish() {
    await db.from("schedules").update({ status: "draft" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-schedule", id] });
  }

  async function deleteSchedule() {
    if (!confirm("هل تريد حذف هذا الجدول؟")) return;
    await db.from("schedules").delete().eq("id", id);
    navigate({ to: "/admin" });
  }

  return (
    <AppShell title="تحرير الجدول" isAdmin>
      <Card className="p-4 mb-4 gradient-sacred text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">قداس الجمعة</p>
            <h2 className="text-xl font-bold">{formatFridayDate(schedule.friday_date)}</h2>
          </div>
          <Badge variant="secondary">{isPublished ? "منشور" : "مسودة"}</Badge>
        </div>
        <div className="flex gap-2 mt-3">
          {isPublished ? (
            <Button size="sm" variant="secondary" onClick={unpublish}>إلغاء النشر</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={publish}><Send className="h-4 w-4" />نشر للأعضاء</Button>
          )}
          <Link to="/admin/schedule/$id/responses" params={{ id }}>
            <Button size="sm" variant="secondary"><ClipboardList className="h-4 w-4" />الردود</Button>
          </Link>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={deleteSchedule}>
            <Trash2 className="h-4 w-4" />حذف
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {SERVICE_ORDER.map((svc) => {
          const list = data.assignments.filter((a) => a.service_type === svc);
          const isMulti = MULTI_SELECT_SERVICES.includes(svc);
          return (
            <Card key={svc} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-primary">{SERVICE_LABELS[svc]}</p>
                  {isMulti && <p className="text-[10px] text-muted-foreground">يمكن اختيار أكثر من واحد</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => openPicker(svc)}>
                  <UserPlus className="h-4 w-4" />اختيار
                </Button>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">لم يُعيَّن أحد بعد</p>
              ) : (
                <div className="space-y-1">
                  {list.map((a) => {
                    const resp = a.attendance_responses?.[0];
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded bg-secondary/40 p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold">
                            {a.profiles?.profile_image_url ? <img src={a.profiles.profile_image_url} className="h-full w-full object-cover" /> : a.profiles?.full_name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate">{a.profiles?.full_name}</p>
                            {resp && (
                              <Badge variant={resp.status === "decline" ? "destructive" : "default"} className="text-[10px]">
                                {resp.status === "attend" ? "سيحضر" : `اعتذر${resp.reason ? " — " + (DECLINE_REASONS[resp.reason] || resp.reason) : ""}`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeAssignment(a.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!pickerFor} onOpenChange={(v) => !v && setPickerFor(null)}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>اختيار: {pickerFor && SERVICE_LABELS[pickerFor]}</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث..." className="pr-8" />
          </div>
          <div className="overflow-y-auto -mx-6 px-6 flex-1">
            <div className="space-y-1">
              {filteredDeacons.map((d) => {
                const checked = tempSel.includes(d.id);
                const isMulti = pickerFor ? MULTI_SELECT_SERVICES.includes(pickerFor) : false;
                return (
                  <label key={d.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent/30 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        if (v) {
                          setTempSel(isMulti ? [...tempSel, d.id] : [d.id]);
                        } else {
                          setTempSel(tempSel.filter((x) => x !== d.id));
                        }
                      }}
                    />
                    <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold">
                      {d.profile_image_url ? <img src={d.profile_image_url} className="h-full w-full object-cover" /> : d.full_name?.charAt(0)}
                    </div>
                    <span className="text-sm flex-1">{d.full_name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerFor(null)}>إلغاء</Button>
            <Button onClick={savePicker}>حفظ ({tempSel.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
