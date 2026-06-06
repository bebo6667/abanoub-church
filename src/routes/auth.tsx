import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Church } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center justify-center">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full gradient-sacred shadow-warm">
          <Church className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-primary">خدمة قداس الجمعة</h1>
        <p className="text-sm text-muted-foreground mt-1">تنظيم خدمة الشمامسة</p>
      </div>

      <Card className="w-full max-w-md p-5 shadow-warm">
        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
            <TabsTrigger value="register">حساب جديد</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-4">
            <LoginForm />
          </TabsContent>
          <TabsContent value="register" className="mt-4">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (res.error) {
          toast.error("تعذّر تسجيل الدخول بـ Google");
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل الدخول بـ Google"}
    </Button>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("مرحباً بعودتك");
      }}
    >
      <div>
        <Label htmlFor="login-email">البريد الإلكتروني</Label>
        <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="login-pass">كلمة السر</Label>
        <Input id="login-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "دخول"}
      </Button>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
        <span className="relative bg-card px-2 text-xs text-muted-foreground mx-auto block w-fit">أو</span>
      </div>
      <GoogleButton />
    </form>
  );
}

function RegisterForm() {
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    whatsapp: "",
    phone: "",
    address: "",
    church_name: "",
    spiritual_father: "",
    email: "",
    password: "",
    requested_role: "deacon",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (form.full_name.trim().split(/\s+/).length < 4) {
          toast.error("الاسم يجب أن يكون رباعياً");
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.full_name,
              age: form.age,
              whatsapp: form.whatsapp,
              phone: form.phone,
              address: form.address,
              church_name: form.church_name,
              spiritual_father: form.spiritual_father,
              requested_role: form.requested_role,
            },
          },
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("تم إنشاء الحساب — بانتظار موافقة الخادم");
      }}
    >
      <Field label="الاسم الرباعي" required>
        <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="الاسم الأول الأب الجد العائلة" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="العمر">
          <Input type="number" min={1} value={form.age} onChange={(e) => set("age", e.target.value)} />
        </Field>
        <Field label="الدور المطلوب">
          <Select value={form.requested_role} onValueChange={(v) => set("requested_role", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deacon">شماس</SelectItem>
              <SelectItem value="servant">خادم</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="رقم واتساب" required>
        <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+20..." required />
      </Field>
      <Field label="رقم هاتف إضافي (اختياري)">
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="العنوان">
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="اسم الكنيسة">
        <Input value={form.church_name} onChange={(e) => set("church_name", e.target.value)} />
      </Field>
      <Field label="اسم أب الاعتراف">
        <Input value={form.spiritual_father} onChange={(e) => set("spiritual_father", e.target.value)} />
      </Field>
      <Field label="البريد الإلكتروني" required>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </Field>
      <Field label="كلمة السر" required>
        <Input type="password" minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء حساب"}
      </Button>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
        <span className="relative bg-card px-2 text-xs text-muted-foreground mx-auto block w-fit">أو</span>
      </div>
      <GoogleButton />
      <p className="text-xs text-muted-foreground text-center">
        بعد التسجيل بـ Google يجب إكمال بيانات الملف الشخصي
      </p>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
