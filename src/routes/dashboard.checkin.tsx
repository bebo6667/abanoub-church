import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFridayDate } from "@/lib/services";
import { CalendarDays, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/checkin")({
  component: CheckinList,
});

function CheckinList() {
  const { isStaff } = useAuth();
  const { data } = useQuery({
    queryKey: ["checkin-schedules"],
    queryFn: async () => {
      const { data } = await db
        .from("schedules")
        .select("*")
        .order("friday_date", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: isStaff,
  });

  if (!isStaff) {
    return (
      <AppShell title="تسجيل الحضور">
        <Card className="p-6 text-center text-sm text-muted-foreground">هذه الصفحة للخدام فقط</Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="تسجيل الحضور" isAdmin>
      <h2 className="text-lg font-bold mb-3">اختر الجدول لتسجيل الحضور</h2>
      <div className="space-y-2">
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
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول بعد</Card>
        )}
      </div>
    </AppShell>
  );
}
