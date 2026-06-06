import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    age: profile?.age?.toString() ?? "",
    whatsapp: profile?.whatsapp ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    church_name: profile?.church_name ?? "",
    spiritual_father: profile?.spiritual_father ?? "",
  });

  async function save() {
    setSaving(true);
    const { error } = await db.from("profiles").update({
      full_name: form.full_name,
      age: form.age ? Number(form.age) : null,
      whatsapp: form.whatsapp,
      phone: form.phone || null,
      address: form.address,
      church_name: form.church_name,
      spiritual_father: form.spiritual_father,
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

  return (
    <AppShell title="حسابي">
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
          {([
            ["الاسم الرباعي", "full_name", "text"],
            ["العمر", "age", "number"],
            ["واتساب", "whatsapp", "text"],
            ["هاتف إضافي", "phone", "text"],
            ["العنوان", "address", "text"],
            ["الكنيسة", "church_name", "text"],
            ["أب الاعتراف", "spiritual_father", "text"],
          ] as const).map(([label, key, type]) => (
            <div key={key}>
              <Label className="mb-1 block">{label}</Label>
              <Input type={type} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
        </Button>
      </Card>
    </AppShell>
  );
}
