import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, formatFridayDate } from "@/lib/services";
import { CalendarDays, ChevronLeft, BellRing, Eye, Bell, BellOff } from "lucide-react";
import { getPermission, requestPermission, type NotifPermission } from "@/lib/notifications";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { toast } from "sonner";


export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { data: schedules } = useQuery({
    queryKey: ["my-schedules", user?.id],
    queryFn: async () => {
      const { data } = await db
        .from("schedules")
        .select("*")
        .eq("status", "published")
        .order("friday_date", { ascending: false })
        .limit(5);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", user?.id],
    queryFn: async () => {
      const { data } = await db
        .from("schedule_assignments")
        .select("*, schedules(friday_date,status), attendance_responses!attendance_responses_assignment_id_fkey(status,reason)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const todayIso = new Date().toISOString().slice(0, 10);
      return ((data ?? []) as any[])
        .filter((a) => a.schedules?.status === "published" && a.schedules?.friday_date >= todayIso);
    },
    enabled: !!user,
  });

  const pending = (assignments ?? []).filter((a) => !a.attendance_responses?.[0]);

  return (
    <AppShell title="خدمة قداس الجمعة">
      <NotificationsBanner />

      {pending.length > 0 && (
        <Card className="p-4 mb-4 border-gold/60 bg-gold/10">
          <div className="flex items-start gap-2">
            <BellRing className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm">لديك {pending.length} خدمة بانتظار ردّك</p>
              <p className="text-xs text-muted-foreground mb-2">افتح الجدول لتأكيد الحضور أو الاعتذار</p>
              <div className="flex flex-col gap-1">
                {pending.map((a) => (
                  <Link key={a.id} to="/dashboard/schedule/$id" params={{ id: a.schedule_id }}
                    className="text-xs underline text-primary">
                    {formatFridayDate(a.schedules.friday_date)} — {SERVICE_LABELS[a.service_type as keyof typeof SERVICE_LABELS]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">خدماتي القادمة</h2>
        {assignments && assignments.length > 0 ? (
          assignments.map((a) => {
            const resp = a.attendance_responses?.[0];
            return (
              <Link
                key={a.id}
                to="/dashboard/schedule/$id"
                params={{ id: a.schedule_id }}
                className="block"
              >
                <Card className="p-4 flex items-center justify-between hover:bg-accent/30 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{formatFridayDate(a.schedules.friday_date)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      <Badge variant="secondary">{SERVICE_LABELS[a.service_type as keyof typeof SERVICE_LABELS]}</Badge>
                      {resp?.status === "attend" && <Badge className="bg-success text-success-foreground">مؤكد الحضور</Badge>}
                      {resp?.status === "decline" && <Badge variant="destructive">اعتذار</Badge>}
                      {!resp && <Badge variant="outline" className="border-gold text-gold">لم ترد بعد</Badge>}
                    </div>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                </Card>
              </Link>
            );
          })
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            لا توجد خدمات مسندة إليك بعد
          </Card>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">آخر الجداول</h2>
        </div>
        {schedules && schedules.length > 0 ? (
          schedules.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-2">
              <span className="flex-1 truncate">{formatFridayDate(s.friday_date)}</span>
              <Link to="/dashboard/schedule/$id" params={{ id: s.id }}>
                <Button size="sm" className="gap-1"><Eye className="h-4 w-4" />عرض</Button>
              </Link>
            </Card>
          ))
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول منشورة</Card>
        )}
      </section>

      <div className="mt-8">
        <AnnouncementsFeed />
      </div>
    </AppShell>
  );
}


function NotificationsBanner() {
  const [perm, setPerm] = useState<NotifPermission>("default");
  useEffect(() => { setPerm(getPermission()); }, []);
  if (perm === "granted" || perm === "unsupported") return null;
  return (
    <Card className="p-3 mb-3 flex items-center gap-2 border-primary/40 bg-primary/5">
      {perm === "denied" ? <BellOff className="h-5 w-5 text-muted-foreground" /> : <Bell className="h-5 w-5 text-primary" />}
      <div className="flex-1 text-xs">
        {perm === "denied"
          ? "الإشعارات معطّلة من المتصفح. فعّلها من إعدادات الموقع لتصلك تنبيهات الخدمة."
          : "فعّل الإشعارات ليصلك تنبيه فور إسناد خدمة جديدة إليك."}
      </div>
      {perm !== "denied" && (
        <Button size="sm" onClick={async () => {
          const r = await requestPermission();
          setPerm(r);
          if (r === "granted") toast.success("تم تفعيل الإشعارات");
        }}>تفعيل</Button>
      )}
    </Card>
  );
}
