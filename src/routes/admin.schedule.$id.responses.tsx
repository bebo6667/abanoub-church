import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERVICE_LABELS, DECLINE_REASONS, formatFridayDate, whatsappDigits, type ServiceType } from "@/lib/services";
import { Loader2, Phone, MessageCircle, ChevronLeft, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/schedule/$id/responses")({
  component: SchedResponses,
});

type Filter = "all" | "pending" | "confirmed" | "excused";

function SchedResponses() {
  const { id } = useParams({ from: "/admin/schedule/$id/responses" });
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["sched-responses", id],
    queryFn: async () => {
      const [{ data: schedule }, { data: assignments }] = await Promise.all([
        db.from("schedules").select("*").eq("id", id).maybeSingle(),
        db.from("schedule_assignments")
          .select("*, profiles!schedule_assignments_user_id_fkey(id,full_name,whatsapp,phone,profile_image_url), attendance_responses!attendance_responses_assignment_id_fkey(status,reason,note,updated_at,created_at)")
          .eq("schedule_id", id),
      ]);
      return { schedule, assignments: (assignments ?? []) as any[] };
    },
  });

  const rows = useMemo(() => {
    const list = (data?.assignments ?? []).map((a) => {
      const r = a.attendance_responses?.[0];
      const status: Filter = !r ? "pending" : r.status === "attend" ? "confirmed" : "excused";
      return { a, r, status };
    });
    return list.filter((x) => filter === "all" || x.status === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, confirmed: 0, excused: 0 };
    for (const a of data?.assignments ?? []) {
      c.all++;
      const r = a.attendance_responses?.[0];
      if (!r) c.pending++;
      else if (r.status === "attend") c.confirmed++;
      else c.excused++;
    }
    return c;
  }, [data]);

  if (isLoading || !data?.schedule) {
    return <AppShell title="ردود الشمامسة" isAdmin><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  return (
    <AppShell title="ردود الشمامسة" isAdmin>
      <Card className="p-4 mb-4 gradient-sacred text-primary-foreground">
        <p className="text-sm opacity-80">قداس الجمعة</p>
        <h2 className="text-xl font-bold">{formatFridayDate(data.schedule.friday_date)}</h2>
        <div className="flex gap-3 mt-3 text-xs">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{counts.confirmed} مؤكد</span>
          <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />{counts.excused} اعتذر</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{counts.pending} بانتظار</span>
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap mb-3">
        {(["all", "pending", "confirmed", "excused"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "الكل" : f === "pending" ? "بانتظار الرد" : f === "confirmed" ? "مؤكد" : "اعتذر"} ({counts[f]})
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">لا نتائج</Card>}
        {rows.map(({ a, r, status }) => {
          const p = a.profiles;
          const wa = whatsappDigits(p?.whatsapp);
          return (
            <Card key={a.id} className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs font-semibold shrink-0">
                  {p?.profile_image_url ? <img src={p.profile_image_url} className="h-full w-full object-cover" /> : p?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p?.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{SERVICE_LABELS[a.service_type as ServiceType] ?? a.service_type}</p>
                </div>
                {status === "confirmed" && <Badge className="bg-success text-success-foreground">مؤكد</Badge>}
                {status === "excused" && <Badge variant="destructive">اعتذر</Badge>}
                {status === "pending" && <Badge variant="outline" className="border-gold text-gold">بانتظار</Badge>}
              </div>
              {status === "excused" && (
                <div className="mt-2 rounded bg-destructive/10 p-2 text-xs">
                  <span className="font-semibold">السبب: </span>
                  {r?.reason ? (DECLINE_REASONS[r.reason] || r.reason) : "—"}
                  {r?.note && <span> — {r.note}</span>}
                </div>
              )}
              {r?.updated_at && (
                <p className="mt-1 text-[10px] text-muted-foreground">وقت الرد: {new Date(r.updated_at).toLocaleString("ar-EG")}</p>
              )}
              <div className="flex items-center gap-1 mt-2 justify-end">
                {wa && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-success"><MessageCircle className="h-4 w-4" /></Button>
                  </a>
                )}
                {p?.phone && (
                  <a href={`tel:${p.phone}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Link to="/admin/schedule/$id" params={{ id }} className="block mt-4">
        <Button variant="outline" className="w-full"><ChevronLeft className="h-4 w-4" />رجوع لتحرير الجدول</Button>
      </Link>
    </AppShell>
  );
}
