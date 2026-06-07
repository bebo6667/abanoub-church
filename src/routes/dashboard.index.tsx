import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, formatFridayDate } from "@/lib/services";
import { CalendarDays, ChevronLeft } from "lucide-react";

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
        .select("*, schedules(friday_date,status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return ((data ?? []) as any[]).filter((a) => a.schedules?.status === "published");
    },
    enabled: !!user,
  });

  return (
    <AppShell title="خدمة قداس الجمعة">
      <section className="space-y-3">
        <h2 className="text-lg font-bold">خدماتي القادمة</h2>
        {assignments && assignments.length > 0 ? (
          assignments.map((a) => (
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
                  <Badge variant="secondary" className="mt-2">{SERVICE_LABELS[a.service_type as keyof typeof SERVICE_LABELS]}</Badge>
                </div>
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </Card>
            </Link>
          ))
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
            <Link key={s.id} to="/dashboard/schedule/$id" params={{ id: s.id }}>
              <Card className="p-4 flex items-center justify-between">
                <span>{formatFridayDate(s.friday_date)}</span>
                <Button variant="ghost" size="sm">عرض</Button>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول منشورة</Card>
        )}
      </section>
    </AppShell>
  );
}
