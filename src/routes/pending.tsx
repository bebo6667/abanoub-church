import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Clock, XCircle, LogOut } from "lucide-react";
import { STATUS_LABELS } from "@/lib/services";

export const Route = createFileRoute("/pending")({
  component: PendingPage,
});

function PendingPage() {
  const { loading, session, profile, isAdmin, signOut, refresh } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    date_of_birth: "",
    whatsapp: "",
    phone: "",
    address: "",
    church_name: "",
    spiritual_father: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (isAdmin) navigate({ to: "/admin", replace: true });
    else if (profile?.status === "approved") navigate({ to: "/dashboard", replace: true });
  }, [loading, session, profile, isAdmin, navigate]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        age: profile.age?.toString() ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        whatsapp: profile.whatsapp ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        church_name: profile.church_name ?? "",
        spiritual_father: profile.spiritual_father ?? "",
      });
      // Show editor if profile is empty (e.g. Google signup)
      if (!profile.whatsapp || !profile.full_name || profile.full_name.split(/\s+/).length < 2) {
        setEditing(true);
      }
    }
  }, [profile]);

  if (loading || !profile) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isRejected = profile.status === "rejected";

  async function save() {
    const { error } = await db.from("profiles").update({
      full_name: form.full_name,
      age: form.age ? Number(form.age) : null,
      date_of_birth: form.date_of_birth || null,
      whatsapp: form.whatsapp,
      phone: form.phone || null,
      address: form.address,
      church_name: form.church_name,
      spiritual_father: form.spiritual_father,
    }).eq("id", session!.user.id);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ البيانات");
    setEditing(false);
    refresh();
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <Card className="p-6 text-center shadow-warm">
          <div className={`mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full ${isRejected ? "bg-destructive/10" : "bg-gold/20"}`}>
            {isRejected ? <XCircle className="h-8 w-8 text-destructive" /> : <Clock className="h-8 w-8 text-gold" />}
          </div>
          <h1 className="text-xl font-bold">{STATUS_LABELS[profile.status]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRejected
              ? `للأسف لم يتم قبول طلبك. السبب: ${profile.rejection_reason || "غير محدد"}`
              : "تم استلام طلبك بنجاح. سيراجعه الخادم قريباً وستتمكن من الوصول للجدول بعد الموافقة."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => refresh()}>تحديث الحالة</Button>
            <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-4 w-4" /> خروج
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">بياناتي</h2>
            {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل</Button>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <FieldRow label="الاسم الرباعي" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <FieldRow label="العمر" type="number" value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
              <FieldRow label="تاريخ الميلاد" type="date" value={form.date_of_birth} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
              <FieldRow label="واتساب (سيُضاف +20 تلقائياً)" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
              <FieldRow label="هاتف إضافي للاتصال" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <FieldRow label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <FieldRow label="الكنيسة" value={form.church_name} onChange={(v) => setForm({ ...form, church_name: v })} />
              <FieldRow label="أب الاعتراف" value={form.spiritual_father} onChange={(v) => setForm({ ...form, spiritual_father: v })} />
              <Button className="w-full" onClick={save}>حفظ</Button>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <Row k="الاسم" v={profile.full_name} />
              <Row k="العمر" v={profile.age?.toString()} />
              <Row k="واتساب" v={profile.whatsapp} />
              <Row k="هاتف" v={profile.phone} />
              <Row k="الكنيسة" v={profile.church_name} />
              <Row k="أب الاعتراف" v={profile.spiritual_father} />
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}
