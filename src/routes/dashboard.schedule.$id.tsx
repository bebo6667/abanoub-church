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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", id],
    queryFn: async () => {
      const [{ data: schedule }, { data: assignments }, { data: response }] = await Promise.all([
        db.from("schedules").select("*").eq("id", id).maybeSingle(),
        db.from("schedule_assignments")
          .select("*, profiles!schedule_assignments_user_id_fkey(id,full_name,whatsapp,phone,profile_image_url)")
          .eq("schedule_id", id),
        db.from("attendance_responses").select("*").eq("schedule_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      return { schedule, assignments: (assignments ?? []) as any[], response };
    },
  });

  if (isLoading || !data?.schedule) {
    return <AppShell title="الجدول"><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  const myAssignments = data.assignments.filter((a) => a.user_id === user!.id);
  const hasMine = myAssignments.length > 0;

  return (
    <AppShell title="جدول الجمعة">
      <Card className="p-4 mb-4 gradient-sacred text-primary-foreground">
        <p className="text-sm opacity-80">قداس الجمعة</p>
        <h2 className="text-xl font-bold">{formatFridayDate(data.schedule.week_date)}</h2>
      </Card>

      {hasMine && (
        <AttendanceCard
          scheduleId={id}
          existing={data.response as any}
          assignments={myAssignments}
          onSaved={() => qc.invalidateQueries({ queryKey: ["schedule", id] })}
        />
      )}

      <h3 className="text-base font-bold mt-6 mb-2">برنامج الخدمة</h3>
      <div className="space-y-2">
        {SERVICE_ORDER.map((svc) => {
          const list = data.assignments.filter((a) => a.service_type === svc);
          if (list.length === 0) return null;
          return (
            <Card key={svc} className="p-3">
              <div className="text-sm font-semibold text-primary mb-2">{SERVICE_LABELS[svc]}</div>
              <div className="space-y-2">
                {list.map((a) => <PersonRow key={a.id} a={a} />)}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

function PersonRow({ a }: { a: any }) {
  const p = a.profiles;
  if (!p) return null;
  const wa = p.whatsapp?.replace(/\D/g, "");
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-xs font-semibold text-secondary-foreground shrink-0 overflow-hidden">
          {p.profile_image_url ? <img src={p.profile_image_url} className="h-full w-full object-cover" /> : p.full_name.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate text-sm">{p.full_name}</p>
          {a.status === "declined" && <Badge variant="destructive" className="text-[10px]">اعتذر</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-success"><MessageCircle className="h-4 w-4" /></Button>
          </a>
        )}
        {p.phone && (
          <a href={`tel:${p.phone}`}>
            <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
          </a>
        )}
      </div>
    </div>
  );
}

function AttendanceCard({ scheduleId, existing, assignments, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("exams");
  const [text, setText] = useState("");

  async function respond(response: "attend" | "decline") {
    if (response === "attend") {
      const { error } = await db.from("attendance_responses").upsert({
        user_id: user!.id, schedule_id: scheduleId, response: "attend", reason: null, reason_text: null,
      }, { onConflict: "user_id,schedule_id" });
      if (error) return toast.error(error.message);
      await db.from("schedule_assignments").update({ status: "confirmed" })
        .eq("schedule_id", scheduleId).eq("user_id", user!.id);
      toast.success("شكراً لتأكيدك");
      onSaved();
    } else {
      setOpen(true);
    }
  }

  async function submitDecline() {
    if (reason === "other" && !text.trim()) return toast.error("اكتب السبب");
    const { error } = await db.from("attendance_responses").upsert({
      user_id: user!.id, schedule_id: scheduleId, response: "decline", reason, reason_text: text || null,
    }, { onConflict: "user_id,schedule_id" });
    if (error) return toast.error(error.message);
    await db.from("schedule_assignments").update({ status: "declined" })
      .eq("schedule_id", scheduleId).eq("user_id", user!.id);
    setOpen(false);
    toast.success("تم تسجيل اعتذارك");
    onSaved();
  }

  const responded = !!existing;

  return (
    <Card className="p-4 border-gold/40">
      <p className="font-semibold mb-1">مسند إليك:</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {assignments.map((a: any) => (
          <Badge key={a.id} variant="secondary">{SERVICE_LABELS[a.service_type as ServiceType]}</Badge>
        ))}
      </div>
      {responded ? (
        <div className="text-sm">
          ردك: <strong>{existing.response === "attend" ? "سأحضر" : "اعتذار"}</strong>
          {existing.reason && <> — {DECLINE_REASONS[existing.reason]}{existing.reason_text ? ` (${existing.reason_text})` : ""}</>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => respond("attend")}><Check className="h-4 w-4" />تغيير: سأحضر</Button>
            <Button size="sm" variant="outline" onClick={() => respond("decline")}><X className="h-4 w-4" />تغيير: اعتذار</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => respond("attend")} className="bg-success text-success-foreground hover:opacity-90"><Check className="h-4 w-4" />سأحضر</Button>
          <Button variant="outline" onClick={() => respond("decline")}><X className="h-4 w-4" />لا أستطيع</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>سبب الاعتذار</DialogTitle></DialogHeader>
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
    </Card>
  );
}
