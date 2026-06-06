import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatFridayDate } from "@/lib/services";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/dashboard/schedule")({
  component: ScheduleList,
});

function ScheduleList() {
  const { data } = useQuery({
    queryKey: ["all-schedules"],
    queryFn: async () => {
      const { data } = await db.from("schedules").select("*").eq("status", "published").order("week_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  return (
    <AppShell title="الجدول">
      <h2 className="text-lg font-bold mb-3">جداول الجمعة</h2>
      <div className="space-y-2">
        {(data ?? []).map((s) => (
          <Link key={s.id} to="/dashboard/schedule/$id" params={{ id: s.id }}>
            <Card className="p-4 flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="font-medium">{formatFridayDate(s.week_date)}</span>
            </Card>
          </Link>
        ))}
        {data && data.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول منشورة بعد</Card>
        )}
      </div>
    </AppShell>
  );
}
