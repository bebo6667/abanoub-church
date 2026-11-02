import { useState } from "react";
import { useAuth, type Profile } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { effectiveAge } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { RANK_LABELS, RANK_ORDER, EDUCATION_LABELS, EDUCATION_ORDER, STATUS_LABELS } from "@/lib/services";

type ChildForm = { id?: string; full_name: string; date_of_birth: string; rank: string; education_stage: string };
const empty: ChildForm = { full_name: "", date_of_birth: "", rank: "", education_stage: "" };

export function GuardianChildren() {
  const { user, profile, isGuardian, children, refresh } = useAuth();
  const [converting, setConverting] = useState(false);
  const [edit, setEdit] = useState<ChildForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function convert() {
    if (!user) return;
    if (!confirm("تحويل حسابك لحساب ولي أمر؟ هتقدر تضيف أبناءك الشمامسة وتتابع خدماتهم من نفس الإيميل.")) return;
    setConverting(true);
    const { error } = await db.from("user_roles").insert({ user_id: user.id, role: "guardian" });
    setConverting(false);
    if (error && !String(error.message).includes("duplicate")) return toast.error(error.message);
    toast.success("بقى حسابك حساب ولي أمر — ضيف أبناءك دلوقتي");
    await refresh();
  }

  async function saveChild() {
    if (!edit || !user) return;
    if (!edit.full_name.trim()) return toast.error("اكتب اسم الابن");
    if (!edit.rank) return toast.error("اختر الرتبة الكنسية");
    if (!edit.education_stage) return toast.error("اختر المرحلة الدراسية");
    setSaving(true);
    const data = {
      full_name: edit.full_name.trim(),
      date_of_birth: edit.date_of_birth || null,
      age: effectiveAge(edit.date_of_birth, null),
      rank: edit.rank as any,
      education_stage: edit.education_stage as any,
    };
    let error;
    if (edit.id) {
      ({ error } = await db.from("profiles").update(data).eq("id", edit.id));
    } else {
      const id = crypto.randomUUID();
      ({ error } = await db.from("profiles").insert({
        ...data,
        id,
        parent_id: user.id,
        requested_role: "deacon",
        status: "pending",
        whatsapp: profile?.whatsapp ?? null,
        phone: profile?.phone ?? null,
        address: profile?.address ?? null,
        church_name: profile?.church_name ?? null,
      }));
      if (!error) await db.from("user_roles").insert({ user_id: id, role: "deacon" });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(edit.id ? "تم تعديل بيانات الابن" : "تمت إضافة الابن — في انتظار موافقة الخادم المسؤول");
    setEdit(null);
    refresh();
  }

  async function removeChild(c: Profile) {
    if (!confirm(`حذف ${c.full_name} من حسابك؟`)) return;
    const { error } = await db.from("profiles").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    refresh();
  }

  if (!isGuardian) {
    return (
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" /> عندك أبناء شمامسة؟</div>
        <p className="text-sm text-muted-foreground">
          حوّل حسابك لحساب ولي أمر عشان تضيف كل أبنائك على نفس الإيميل، ولكل ابن بياناته وخدمته وحضوره.
        </p>
        <Button variant="outline" className="w-full" onClick={convert} disabled={converting}>
          {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : "التحويل إلى حساب ولي أمر"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" /> أبنائي</div>
        <Button size="sm" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4 ml-1" /> إضافة ابن</Button>
      </div>
      {children.length === 0 && <p className="text-sm text-muted-foreground">لسه مفيش أبناء — اضغط «إضافة ابن».</p>}
      <div className="space-y-2">
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">{c.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {c.rank ? RANK_LABELS[c.rank] : "—"} · {c.education_stage ? EDUCATION_LABELS[c.education_stage as keyof typeof EDUCATION_LABELS] : "—"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={c.status === "approved" ? "default" : "secondary"}>{STATUS_LABELS[c.status] ?? c.status}</Badge>
              <Button size="icon" variant="ghost" aria-label="تعديل" onClick={() => setEdit({ id: c.id, full_name: c.full_name, date_of_birth: c.date_of_birth ?? "", rank: c.rank ?? "", education_stage: c.education_stage ?? "" })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => removeChild(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "تعديل بيانات الابن" : "إضافة ابن"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label className="mb-1 block">الاسم الثلاثي</Label>
                <Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
              <div><Label className="mb-1 block">تاريخ الميلاد</Label>
                <Input type="date" value={edit.date_of_birth} onChange={(e) => setEdit({ ...edit, date_of_birth: e.target.value })} /></div>
              <div><Label className="mb-1 block">الرتبة الكنسية</Label>
                <Select value={edit.rank} onValueChange={(v) => setEdit({ ...edit, rank: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الرتبة" /></SelectTrigger>
                  <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{RANK_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="mb-1 block">المرحلة الدراسية</Label>
                <Select value={edit.education_stage} onValueChange={(v) => setEdit({ ...edit, education_stage: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                  <SelectContent>{EDUCATION_ORDER.map((s) => <SelectItem key={s} value={s}>{EDUCATION_LABELS[s as keyof typeof EDUCATION_LABELS]}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>إلغاء</Button>
            <Button onClick={saveChild} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
