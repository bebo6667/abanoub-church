import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFridayDate } from "@/lib/services";
import { CalendarDays, Eye } from "lucide-react";

export const Route = createFileRoute("/dashboard/schedule/")({
  component: ScheduleList,
});

function ScheduleList() {
  const { data } = useQuery({
    queryKey: ["all-schedules"],
    queryFn: async () => {
      const { data } = await db.from("schedules").select("*").eq("status", "published").order("friday_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  return (
    <AppShell title="الجدول">
      <h2 className="text-lg font-bold mb-3">جداول الجمعة</h2>
      <p className="text-xs text-muted-foreground mb-3">اضغط «عرض» لرؤية الجدول الكامل ومن عليه كل خدمة</p>
      <div className="space-y-2">
        {(data ?? []).map((s) => (
          <Card key={s.id} className="p-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary shrink-0" />
            <span className="font-medium flex-1 truncate">{formatFridayDate(s.friday_date)}</span>
            <Link to="/dashboard/schedule/$id" params={{ id: s.id }}>
              <Button size="sm" className="gap-1"><Eye className="h-4 w-4" />عرض</Button>
            </Link>
          </Card>
        ))}
        {data && data.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول منشورة بعد</Card>
        )}
      </div>
    </AppShell>
  );
}
