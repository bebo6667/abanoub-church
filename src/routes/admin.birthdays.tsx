import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cake, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  MONTH_NAMES_AR, birthDay, birthMonth, computeAge, formatBirthDate, turningAge,
} from "@/lib/age";

export const Route = createFileRoute("/admin/birthdays")({
  component: BirthdaysPage,
  head: () => ({
    meta: [
      { title: "أعياد ميلاد الشمامسة | خدمة الشمامسة" },
      { name: "description", content: "تجميع أعياد ميلاد الشمامسة كل شهر ونشر إعلان تهنئة بضغطة زر." },
      { property: "og:title", content: "أعياد ميلاد الشمامسة" },
      { property: "og:description", content: "قائمة أعياد ميلاد الشمامسة لهذا الشهر مع نشر إعلان تهنئة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Member = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  age: number | null;
  profile_image_url: string | null;
};

function BirthdaysPage() {
  const { user, isAdmin } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [publishing, setPublishing] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["birthday-members"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id,full_name,date_of_birth,age,profile_image_url,status,user_roles!user_roles_user_id_fkey(role)")
        .eq("status", "approved");
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((p) => (p.user_roles ?? []).some((r: any) => r.role === "deacon") || (p.user_roles ?? []).length === 0)
        .map((p) => ({
          id: p.id, full_name: p.full_name, date_of_birth: p.date_of_birth,
          age: p.age, profile_image_url: p.profile_image_url,
        })) as Member[];
    },
  });

  const list = useMemo(() => {
    return (members ?? [])
      .filter((m) => birthMonth(m.date_of_birth) === month)
      .sort((a, b) => (birthDay(a.date_of_birth) ?? 0) - (birthDay(b.date_of_birth) ?? 0));
  }, [members, month]);

  const namesBlock = list
    .map((m) => {
      const t = m.date_of_birth ? turningAge(m.date_of_birth, year) : null;
      return `• ${m.full_name} — ${m.date_of_birth ? formatBirthDate(m.date_of_birth) : "—"}${t ? ` (يكمل ${t} سنة)` : ""}`;
    })
    .join("\n");

  const defaultTitle = `كل سنة وأنتم طيبين — أعياد ميلاد شهر ${MONTH_NAMES_AR[month - 1]}`;
  const defaultMessage =
    `نهنئ أحبائنا الشمامسة أصحاب أعياد الميلاد في شهر ${MONTH_NAMES_AR[month - 1]}، ربنا يبارك حياتكم وخدمتكم ويعطيكم سنين كثيرة مباركة. 🎂`;

  async function publish() {
    if (list.length === 0) return toast.error("لا يوجد أعياد ميلاد في هذا الشهر.");
    setPublishing(true);
    const body = `${(message.trim() || defaultMessage)}\n\n🎉 أصحاب أعياد الميلاد:\n${namesBlock}`;
    const { error } = await db.from("announcements").insert({
      title: title.trim() || defaultTitle,
      body,
      is_published: true,
      created_by: user!.id,
      attachments: [],
    });
    setPublishing(false);
    if (error) return toast.error(error.message);
    toast.success("تم نشر إعلان التهنئة ووصل إشعار لكل الأعضاء.");
    setMessage("");
    setTitle("");
  }

  return (
    <AppShell title="أعياد الميلاد" isAdmin={isAdmin}>
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Cake className="h-5 w-5 text-primary" />
          <h1 className="font-bold">أعياد ميلاد الشمامسة</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block text-xs">الشهر</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES_AR.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">السنة</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">
            المولودون في {MONTH_NAMES_AR[month - 1]}
          </h2>
          <Badge variant="secondary">{list.length}</Badge>
        </div>
        {isLoading ? (
          <div className="py-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">لا يوجد أعياد ميلاد في هذا الشهر.</p>
        ) : (
          <ul className="divide-y">
            {list.map((m) => (
              <li key={m.id} className="py-2 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden grid place-items-center text-sm font-semibold">
                  {m.profile_image_url
                    ? <img src={m.profile_image_url} className="h-full w-full object-cover" alt="" />
                    : m.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.date_of_birth ? formatBirthDate(m.date_of_birth) : "—"}
                    {m.date_of_birth && computeAge(m.date_of_birth) !== null && ` • العمر الآن ${computeAge(m.date_of_birth)} سنة`}
                  </p>
                </div>
                {m.date_of_birth && turningAge(m.date_of_birth, year) && (
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    يكمل {turningAge(m.date_of_birth, year)}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">إعلان التهنئة</h2>
        <div>
          <Label className="mb-1 block text-xs">عنوان الإعلان</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">رسالة التهنئة</Label>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={defaultMessage} />
        </div>
        {list.length > 0 && (
          <div className="rounded-md bg-secondary/40 p-3 text-xs whitespace-pre-wrap leading-6">
            {`${(message.trim() || defaultMessage)}\n\n🎉 أصحاب أعياد الميلاد:\n${namesBlock}`}
          </div>
        )}
        <Button className="w-full" onClick={publish} disabled={publishing || list.length === 0}>
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          نشر إعلان التهنئة
        </Button>
      </Card>
    </AppShell>
  );
}
