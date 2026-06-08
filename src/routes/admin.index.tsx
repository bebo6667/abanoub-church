import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatFridayDate } from "@/lib/services";
import { Plus, CalendarDays, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function nextFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function AdminHome() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(nextFriday());

  const { data: schedules } = useQuery({
    queryKey: ["admin-schedules"],
    queryFn: async () => {
      const { data } = await db.from("schedules").select("*").order("friday_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      const { count } = await db.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
  });

  async function createSchedule() {
    const { data, error } = await db.from("schedules").insert({
      friday_date: date, status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-schedules"] });
    navigate({ to: "/admin/schedule/$id", params: { id: data.id } });
  }

  return (
    <AppShell title="لوحة الخادم" isAdmin>
      {pendingCount && pendingCount > 0 ? (
        <Link to="/dashboard/members">
          <Card className="p-4 mb-4 bg-gold/20 border-gold flex items-center justify-between">
            <div>
              <p className="font-semibold">{pendingCount} طلب{pendingCount > 1 ? "ات" : ""} بانتظار المراجعة</p>
              <p className="text-xs text-muted-foreground">اضغط للمراجعة</p>
            </div>
            <ChevronLeft className="h-5 w-5" />
          </Card>
        </Link>
      ) : null}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">الجداول</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />جدول جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إنشاء جدول جمعة جديد</DialogTitle></DialogHeader>
            <div>
              <label className="text-sm mb-1 block">تاريخ الجمعة</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={createSchedule}>إنشاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(schedules ?? []).map((s) => (
          <Link key={s.id} to="/admin/schedule/$id" params={{ id: s.id }}>
            <Card className="p-4 flex items-center justify-between hover:bg-accent/30">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{formatFridayDate(s.friday_date)}</p>
                  <Badge variant={s.status === "published" ? "default" : "secondary"} className="text-[10px] mt-1">
                    {s.status === "published" ? "منشور" : "مسودة"}
                  </Badge>
                </div>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </Card>
          </Link>
        ))}
        {schedules && schedules.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جداول. أنشئ أول جدول.</Card>
        )}
      </div>
    </AppShell>
  );
}
