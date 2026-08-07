import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { effectiveAge } from "@/lib/age";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, MapPin, Crosshair } from "lucide-react";
import { RANK_LABELS, RANK_ORDER, EDUCATION_LABELS, EDUCATION_ORDER, mapsUrl } from "@/lib/services";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, isAdmin, roles, refresh } = useAuth();
  const isDeacon = roles.includes("deacon");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    age: profile?.age?.toString() ?? "",
    date_of_birth: profile?.date_of_birth ?? "",
    whatsapp: profile?.whatsapp ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    church_name: profile?.church_name ?? "",
    spiritual_father: profile?.spiritual_father ?? "",
    rank: profile?.rank ?? "",
    education_stage: profile?.education_stage ?? "",
    last_confession_date: profile?.last_confession_date ?? "",
    home_latitude: profile?.home_latitude ?? null as number | null,
    home_longitude: profile?.home_longitude ?? null as number | null,
    linked_servant_id: profile?.linked_servant_id ?? "",
  });

  const { data: servants } = useQuery({
    queryKey: ["servants-list"],
    queryFn: async () => {
      const { data } = await db
        .from("profiles")
        .select("id, full_name, user_roles!user_roles_user_id_fkey(role)")
        .eq("status", "approved");
      return ((data ?? []) as any[]).filter(
        (u) => u.user_roles?.[0]?.role === "servant" || u.user_roles?.[0]?.role === "admin"
      );
    },
    enabled: isDeacon && profile?.status === "approved",
  });

  async function save() {
    if (!form.full_name.trim()) return toast.error("الاسم مطلوب");
    if (!form.rank) return toast.error("اختر الرتبة الكنسية");
    if (!form.education_stage) return toast.error("اختر المرحلة الدراسية");
    setSaving(true);
    const { error } = await db.from("profiles").update({
      full_name: form.full_name,
      age: form.age ? Number(form.age) : null,
      date_of_birth: form.date_of_birth || null,
      whatsapp: form.whatsapp,
      phone: form.phone || null,
      address: form.address,
      church_name: form.church_name,
      spiritual_father: form.spiritual_father,
      rank: (form.rank || null) as any,
      education_stage: (form.education_stage || null) as any,
      last_confession_date: form.last_confession_date || null,
      home_latitude: form.home_latitude,
      home_longitude: form.home_longitude,
      linked_servant_id: form.linked_servant_id || null,
    }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    refresh();
  }

  async function uploadAvatar(file: File) {
    const path = `${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await db.from("profiles").update({ profile_image_url: data.publicUrl }).eq("id", user!.id);
    refresh();
    toast.success("تم رفع الصورة");
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      return toast.error("المتصفح لا يدعم تحديد الموقع — جرّب من متصفح آخر.");
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, home_latitude: pos.coords.latitude, home_longitude: pos.coords.longitude }));
        setLocating(false);
        toast.success("تم التقاط الموقع. لا تنسَ الضغط على «حفظ» بالأسفل.");
      },
      (err) => {
        setLocating(false);
        let msg = "تعذر تحديد الموقع.";
        if (err.code === err.PERMISSION_DENIED)
          msg = "تم رفض إذن الموقع. افتح إعدادات المتصفح وفعّل الإذن للموقع ثم حاول مرة أخرى.";
        else if (err.code === err.POSITION_UNAVAILABLE)
          msg = "إشارة GPS غير متاحة الآن. جرّب بالقرب من نافذة أو فعّل خدمة الموقع بالهاتف.";
        else if (err.code === err.TIMEOUT)
          msg = "انتهت مهلة الالتقاط. أعد المحاولة من فضلك.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const map = mapsUrl(form.home_latitude, form.home_longitude);

  return (
    <AppShell title="حسابي" isAdmin={isAdmin}>
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-secondary overflow-hidden grid place-items-center text-2xl font-bold text-secondary-foreground">
            {profile?.profile_image_url
              ? <img src={profile.profile_image_url} className="h-full w-full object-cover" />
              : profile?.full_name?.charAt(0)}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> رفع صورة
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <Field label="الاسم الرباعي" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="العمر" type="number" value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
            <Field label="تاريخ الميلاد" type="date" value={form.date_of_birth} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
          </div>

          <div>
            <Label className="mb-1 block">الرتبة الكنسية <span className="text-destructive">*</span></Label>
            <Select value={form.rank || ""} onValueChange={(v) => setForm({ ...form, rank: v as any })}>
              <SelectTrigger><SelectValue placeholder="اختر الرتبة" /></SelectTrigger>
              <SelectContent>
                {RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{RANK_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">المرحلة الدراسية <span className="text-destructive">*</span></Label>
            <Select value={form.education_stage || ""} onValueChange={(v) => setForm({ ...form, education_stage: v as any })}>
              <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_ORDER.map((s) => <SelectItem key={s} value={s}>{EDUCATION_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Field label="تاريخ آخر اعتراف" type="date" value={form.last_confession_date} onChange={(v) => setForm({ ...form, last_confession_date: v })} />

          {isDeacon && (
            <div>
              <Label className="mb-1 block">الخادم المسؤول (السِنْد)</Label>
              <Select value={form.linked_servant_id || "__none__"} onValueChange={(v) => setForm({ ...form, linked_servant_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="اختر خادمك" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون —</SelectItem>
                  {(servants ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Field label="واتساب (سيُضاف +20 تلقائياً)" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
          <Field label="هاتف إضافي للاتصال" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />

          <Field label="العنوان (اكتبه يدوياً)" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

          <div className="rounded-lg border p-3 bg-secondary/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">موقع المنزل على الخريطة</Label>
              <Button type="button" size="sm" variant="outline" onClick={captureLocation} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4 ml-1" />}
                {locating ? "جاري التحديد..." : "تحديث موقعي الآن"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ تأكد أنك بداخل منزلك قبل الضغط — الإحداثيات هتستخدم لفتح خريطة بيتك للخدام.
            </p>
            {form.home_latitude != null && form.home_longitude != null ? (
              <div className="flex items-center justify-between text-xs" dir="ltr">
                <span className="font-mono">{form.home_latitude.toFixed(5)}, {form.home_longitude.toFixed(5)}</span>
                {map && (
                  <a href={map} target="_blank" rel="noopener noreferrer">
                    <Button type="button" size="sm" variant="ghost" className="h-7">
                      <MapPin className="h-4 w-4 ml-1" /> معاينة
                    </Button>
                  </a>
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground">لم يتم تحديد الموقع بعد</p>}
          </div>

          <Field label="الكنيسة" value={form.church_name} onChange={(v) => setForm({ ...form, church_name: v })} />
          <Field label="أب الاعتراف" value={form.spiritual_father} onChange={(v) => setForm({ ...form, spiritual_father: v })} />
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
        </Button>
      </Card>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
