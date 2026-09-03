import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { effectiveAge, formatBirthDate, birthMonth, MONTH_NAMES_AR } from "@/lib/age";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RANK_LABELS, EDUCATION_LABELS, formatDate, formatFridayDate,
  normalizeWhatsapp, SERVICE_LABELS, type ServiceType,
} from "@/lib/services";
import { Loader2, Printer, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "كشوف الشمامسة | خدمة قداس الجمعة" },
      { name: "description", content: "طباعة كشف PDF ببيانات الشمامسة ونسب الحضور وآخر افتقاد وآخر خدمة وآخر اعتراف." },
      { property: "og:title", content: "كشوف الشمامسة" },
      { property: "og:description", content: "طباعة كشف بيانات الشمامسة ونسب حضورهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SortKey = "name" | "attendance" | "last_visit" | "last_service" | "last_confession";
type Layout = "both" | "table" | "cards";

type ReportField = {
  key: string;
  label: string;
  ltr?: boolean;
  get: (m: any, totalMasses: number) => unknown;
};

const REPORT_FIELDS: ReportField[] = [
  { key: "rank", label: "الرتبة", get: (m) => (m.rank ? RANK_LABELS[m.rank as keyof typeof RANK_LABELS] : null) },
  { key: "education", label: "المرحلة الدراسية", get: (m) => (m.education_stage ? EDUCATION_LABELS[m.education_stage as keyof typeof EDUCATION_LABELS] : null) },
  { key: "age", label: "السن", get: (m) => effectiveAge(m.date_of_birth, m.age) },
  { key: "dob", label: "تاريخ الميلاد", get: (m) => (m.date_of_birth ? formatBirthDate(m.date_of_birth) : null) },
  { key: "birth_month", label: "شهر الميلاد", get: (m) => { const mo = birthMonth(m.date_of_birth); return mo ? MONTH_NAMES_AR[mo - 1] : null; } },
  { key: "whatsapp", label: "الواتساب", ltr: true, get: (m) => normalizeWhatsapp(m.whatsapp) },
  { key: "phone", label: "الهاتف", ltr: true, get: (m) => m.phone },
  { key: "email", label: "البريد", ltr: true, get: (m) => m.email },
  { key: "church", label: "الكنيسة", get: (m) => m.church_name },
  { key: "father", label: "أب الاعتراف", get: (m) => m.spiritual_father },
  { key: "address", label: "العنوان", get: (m) => m.address },
  { key: "present", label: "الحضور", get: (m) => `${m.present} مرة` },
  { key: "absent", label: "الغياب", get: (m) => `${m.absent} مرة` },
  { key: "recorded", label: "القداسات المسجّلة", get: (m, t) => `${m.recorded} من ${t}` },
  { key: "pct", label: "نسبة المواظبة", get: (m) => `${m.pct}%` },
  { key: "last_present", label: "آخر حضور", get: (m) => (m.lastPresent ? formatDate(m.lastPresent) : null) },
  { key: "last_visit", label: "آخر افتقاد", get: (m) => (m.lastVisit ? formatDate(m.lastVisit) : null) },
  { key: "last_service", label: "آخر خدمة", get: (m) => (m.lastService ? `${formatDate(m.lastService.date)} — ${m.lastService.service}` : null) },
  { key: "last_confession", label: "آخر اعتراف", get: (m) => formatDate(m.last_confession_date) },
];

const DEFAULT_FIELDS = REPORT_FIELDS.map((f) => f.key);

function daysSince(d?: string | null) {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}


function ReportsPage() {
  const { isStaff } = useAuth();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [layout, setLayout] = useState<Layout>("both");
  const [showFields, setShowFields] = useState(false);
  const [fields, setFields] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEFAULT_FIELDS.map((k) => [k, true])),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["report-data"],
    queryFn: async () => {
      const [{ data: members }, { data: schedules }, { data: checkins }, { data: visits }, { data: assignments }] =
        await Promise.all([
          db.from("profiles")
            .select("*, user_roles!user_roles_user_id_fkey(role)")
            .eq("status", "approved").order("full_name"),
          db.from("schedules").select("id, friday_date"),
          db.from("attendance_checkins").select("user_id, present, schedule_id"),
          db.from("visitations").select("deacon_id, visited_at, note"),
          db.from("schedule_assignments").select("user_id, service_type, schedule_id"),
        ]);
      const deacons = ((members ?? []) as any[]).filter((m) => {
        const roles = (m.user_roles ?? []).map((r: any) => r.role);
        return roles.includes("deacon") && !roles.includes("admin") && !roles.includes("servant");
      });
      const dateById = new Map<string, string>((schedules ?? []).map((s: any) => [s.id, s.friday_date]));
      return {
        deacons,
        totalMasses: (schedules ?? []).length,
        checkins: (checkins ?? []) as any[],
        visits: (visits ?? []) as any[],
        assignments: (assignments ?? []) as any[],
        dateById,
      };
    },
    enabled: isStaff,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const stats = new Map<string, { present: number; absent: number; lastPresent: string | null }>();
    for (const c of data.checkins) {
      const s = stats.get(c.user_id) ?? { present: 0, absent: 0, lastPresent: null };
      if (c.present) {
        s.present++;
        const d = data.dateById.get(c.schedule_id) ?? null;
        if (d && (!s.lastPresent || d > s.lastPresent)) s.lastPresent = d;
      } else s.absent++;
      stats.set(c.user_id, s);
    }
    const lastVisit = new Map<string, string>();
    for (const v of data.visits) {
      const cur = lastVisit.get(v.deacon_id);
      if (!cur || v.visited_at > cur) lastVisit.set(v.deacon_id, v.visited_at);
    }
    const lastService = new Map<string, { date: string; service: string }>();
    for (const a of data.assignments) {
      const d = data.dateById.get(a.schedule_id);
      if (!d) continue;
      const cur = lastService.get(a.user_id);
      if (!cur || d > cur.date) {
        lastService.set(a.user_id, {
          date: d,
          service: SERVICE_LABELS[a.service_type as ServiceType] ?? a.service_type,
        });
      }
    }

    const term = q.trim().toLowerCase();
    const list = data.deacons
      .filter((m) => !term || m.full_name?.toLowerCase().includes(term))
      .map((m) => {
        const s = stats.get(m.id) ?? { present: 0, absent: 0, lastPresent: null };
        const recorded = s.present + s.absent;
        return {
          ...m,
          present: s.present,
          absent: s.absent,
          recorded,
          pct: recorded === 0 ? 0 : Math.round((s.present / recorded) * 100),
          lastPresent: s.lastPresent,
          lastVisit: lastVisit.get(m.id) ?? null,
          lastService: lastService.get(m.id) ?? null,
        };
      });

    const nullLast = (v: string | null) => (v ? new Date(v).getTime() : -Infinity);
    list.sort((a, b) => {
      switch (sort) {
        case "attendance": return a.pct - b.pct;
        case "last_visit": return nullLast(a.lastVisit) - nullLast(b.lastVisit);
        case "last_service": return nullLast(a.lastService?.date ?? null) - nullLast(b.lastService?.date ?? null);
        case "last_confession": return nullLast(a.last_confession_date) - nullLast(b.last_confession_date);
        default: return String(a.full_name).localeCompare(String(b.full_name), "ar");
      }
    });
    return list;
  }, [data, q, sort]);

  const selectedRows = rows.filter((r) => selected[r.id]);
  const allSelected = rows.length > 0 && rows.every((r) => selected[r.id]);

  function toggleAll() {
    const next: Record<string, boolean> = { ...selected };
    for (const r of rows) next[r.id] = !allSelected;
    setSelected(next);
  }

  function print(target: any[]) {
    if (target.length === 0) return toast.error("اختر شماسًا واحدًا على الأقل");
    const keys = REPORT_FIELDS.filter((f) => fields[f.key]).map((f) => f.key);
    if (keys.length === 0) return toast.error("اختر بيانًا واحدًا على الأقل للطباعة");
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return toast.error("امنع حجب النوافذ المنبثقة للطباعة");
    w.document.write(buildReportHtml(target, data?.totalMasses ?? 0, keys, layout));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }


  if (!isStaff) {
    return <AppShell title="الكشوف"><Card className="p-6 text-center text-sm text-muted-foreground">هذه الصفحة للخدام والأدمن فقط</Card></AppShell>;
  }
  if (isLoading) {
    return <AppShell title="الكشوف" isAdmin><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  return (
    <AppShell title="كشوف الشمامسة" isAdmin>
      <Card className="p-3 mb-3 space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم..." className="pr-8 h-9" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">ترتيب: الاسم</SelectItem>
              <SelectItem value="attendance">ترتيب: الأقل مواظبة</SelectItem>
              <SelectItem value="last_visit">ترتيب: الأقدم افتقادًا</SelectItem>
              <SelectItem value="last_service">ترتيب: الأقدم خدمة</SelectItem>
              <SelectItem value="last_confession">ترتيب: الأقدم اعترافًا</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={toggleAll}>
            {allSelected ? "إلغاء التحديد" : "تحديد الكل"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-1" onClick={() => print(rows)}>
            <Printer className="h-4 w-4" />طباعة الكل ({rows.length})
          </Button>
          <Button variant="outline" className="flex-1 gap-1" onClick={() => print(selectedRows)}>
            <Printer className="h-4 w-4" />طباعة المحدد ({selectedRows.length})
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          تُفتح نافذة الطباعة، اختر «حفظ كـ PDF» لتنزيل الكشف.
        </p>
      </Card>

      <div className="space-y-2">
        {rows.map((m) => {
          const visitDays = daysSince(m.lastVisit);
          const confDays = daysSince(m.last_confession_date);
          return (
            <Card key={m.id} className="p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={!!selected[m.id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [m.id]: !!v }))}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{m.full_name}</p>
                    <Badge className={m.pct >= 75 ? "bg-success text-success-foreground" : m.pct >= 50 ? "" : "bg-destructive text-destructive-foreground"}>
                      {m.pct}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    حاضر {m.present} • غائب {m.absent} • من أصل {m.recorded}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    آخر افتقاد: {m.lastVisit ? `${formatDate(m.lastVisit)} (${visitDays} يوم)` : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    آخر خدمة: {m.lastService ? `${formatFridayDate(m.lastService.date)} — ${m.lastService.service}` : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    آخر اعتراف: {m.last_confession_date ? `${formatDate(m.last_confession_date)} (${confDays} يوم)` : "—"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => print([m])}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && <Card className="p-6 text-center text-xs text-muted-foreground">لا توجد بيانات</Card>}
      </div>
    </AppShell>
  );
}

function esc(v: unknown) {
  return String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function buildReportHtml(rows: any[], totalMasses: number, keys: string[], layout: Layout) {
  const today = new Date().toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  const fields = REPORT_FIELDS.filter((f) => keys.includes(f.key));

  const cards = rows.map((m) => {
    const cells = fields.map((f) => `<tr><th>${f.label}</th><td${f.ltr ? ' dir="ltr"' : ""}>${esc(f.get(m, totalMasses))}</td></tr>`).join("");
    return `
    <section class="card">
      <div class="head">
        <h2>${esc(m.full_name)}</h2>
        <span class="pct">${m.pct}%</span>
      </div>
      <table>${cells}</table>
    </section>`;
  }).join("");

  const summary = `
    <table class="summary">
      <thead><tr><th>#</th><th>الاسم</th>${fields.map((f) => `<th>${f.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((m, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(m.full_name)}</td>
          ${fields.map((f) => `<td${f.ltr ? ' dir="ltr"' : ""}>${esc(f.get(m, totalMasses))}</td>`).join("")}
        </tr>`).join("")}
      </tbody>
    </table>`;


  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>كشف بيانات الشمامسة</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1c1917; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d6d3d1; padding: 5px 7px; text-align: right; }
  th { background: #f5f5f4; font-weight: 600; white-space: nowrap; }
  .summary { margin-bottom: 24px; }
  .card { page-break-inside: avoid; border: 1px solid #d6d3d1; border-radius: 8px; padding: 10px; margin-bottom: 14px; }
  .card .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .card h2 { font-size: 15px; margin: 0; }
  .pct { font-size: 13px; font-weight: 700; background: #f5f5f4; border-radius: 999px; padding: 2px 10px; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h1>كشف بيانات الشمامسة</h1>
<div class="meta">عدد الشمامسة: ${rows.length} • إجمالي القداسات: ${totalMasses} • تاريخ الطباعة: ${today}</div>
${layout !== "cards" ? summary : ""}
${layout !== "table" ? cards : ""}
</body></html>`;
}
