import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_LABELS, SERVICE_ORDER, formatFridayDate, DECLINE_REASONS, type ServiceType } from "@/lib/services";
import { Phone, MessageCircle, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/schedule/$id")({
  component: ScheduleDetail,
});

function ScheduleDetail() {
  const { id } = useParams({ from: "/dashboard/schedule/$id" });
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();


  const { data, isLoading } = useQuery({
    queryKey: ["schedule", id, user?.id],
    queryFn: async () => {
      const [{ data: schedule }, { data: assignments }] = await Promise.all([
        db.from("schedules").select("*").eq("id", id).maybeSingle(),
        db.from("schedule_assignments")
          .select("*, profiles!schedule_assignments_user_id_fkey(id,full_name,whatsapp,phone,profile_image_url), attendance_responses!attendance_responses_assignment_id_fkey(*)")
          .eq("schedule_id", id),
      ]);
      return { schedule, assignments: (assignments ?? []) as any[] };
    },
  });

  if (isLoading || !data?.schedule) {
    return <AppShell title="الجدول"><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule", id] });

  return (
    <AppShell title="جدول الجمعة">
      <Card className="p-4 mb-4 gradient-sacred text-primary-foreground text-center">
        <p className="text-sm opacity-90">+ خدمة قداس يوم الجمعة +</p>
        <h2 className="text-xl font-bold">{formatFridayDate(data.schedule.friday_date)}</h2>
      </Card>

      <Card className="p-3 mb-4">
        <ul className="space-y-3">
          {SERVICE_ORDER.map((svc) => {
            const list = data.assignments.filter((a) => a.service_type === svc);
            return (
              <li key={svc} className="border-b border-border/40 last:border-0 pb-2 last:pb-0">
                <div className="text-sm font-bold text-primary mb-1">{SERVICE_LABELS[svc]}:</div>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground pr-2">—</p>
                ) : (
                  <div className="space-y-1.5 pr-2">
                    {list.map((a) => (
                      <AssignmentLine
                        key={a.id}
                        a={a}
                        isMine={a.user_id === user!.id}
                        canManage={isStaff}
                        onSaved={refresh}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <h3 className="text-base font-bold mt-6 mb-2">كل الشمامسة الذين عليهم خدمة</h3>
      <div className="space-y-2">
        {(() => {
          const byUser = new Map<string, { profile: any; services: string[] }>();
          for (const a of data.assignments) {
            if (!a.profiles) continue;
            const entry = byUser.get(a.user_id) ?? { profile: a.profiles, services: [] };
            entry.services.push(SERVICE_LABELS[a.service_type as ServiceType] ?? a.service_type);
            byUser.set(a.user_id, entry);
          }
          const rows = Array.from(byUser.values());
          if (rows.length === 0) return <Card className="p-4 text-center text-xs text-muted-foreground">لا يوجد مخدومون بعد</Card>;
          return rows.map(({ profile, services }) => {
            const wa = profile.whatsapp?.replace(/\D/g, "");
            return (
              <Card key={profile.id} className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold shrink-0">
                    {profile.profile_image_url ? <img src={profile.profile_image_url} className="h-full w-full object-cover" /> : profile.full_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{profile.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{services.join("، ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {wa && (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-success"><MessageCircle className="h-4 w-4" /></Button>
                    </a>
                  )}
                  {profile.phone && (
                    <a href={`tel:${profile.phone}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
                    </a>
                  )}
                </div>
              </Card>
            );
          });
        })()}
      </div>
    </AppShell>
  );
}

function AssignmentLine({ a, isMine, onSaved }: { a: any; isMine: boolean; onSaved: () => void }) {
  const { user } = useAuth();
  const p = a.profiles;
  const resp = a.attendance_responses?.[0];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("exams");
  const [text, setText] = useState("");

  async function attend() {
    const { error } = await db.from("attendance_responses").upsert({
      user_id: user!.id, assignment_id: a.id, status: "attend", reason: null, note: null,
    }, { onConflict: "assignment_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("تم تأكيد الحضور");
    onSaved();
  }
  async function submitDecline() {
    if (reason === "other" && !text.trim()) return toast.error("اكتب السبب");
    const { error } = await db.from("attendance_responses").upsert({
      user_id: user!.id, assignment_id: a.id, status: "decline", reason, note: text || null,
    }, { onConflict: "assignment_id,user_id" });
    if (error) return toast.error(error.message);
    setOpen(false);
    toast.success("تم تسجيل اعتذارك");
    onSaved();
  }

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-sm">{p?.full_name ?? "—"}</span>
        {resp?.status === "attend" && <Badge className="bg-success text-success-foreground text-[10px]">حاضر</Badge>}
        {resp?.status === "decline" && <Badge variant="destructive" className="text-[10px]">اعتذر</Badge>}
      </div>
      {isMine && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant={resp?.status === "attend" ? "default" : "outline"}
            className={resp?.status === "attend" ? "bg-success text-success-foreground h-7 px-2" : "h-7 px-2"}
            onClick={attend}>
            <Check className="h-3.5 w-3.5" />سأحضر
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setOpen(true)}>
            <X className="h-3.5 w-3.5" />اعتذار
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>سبب الاعتذار — {SERVICE_LABELS[a.service_type as ServiceType]}</DialogTitle></DialogHeader>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DECLINE_REASONS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "other" && (
                <Textarea placeholder="اذكر السبب..." value={text} onChange={(e) => setText(e.target.value)} />
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={submitDecline}>تأكيد الاعتذار</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
