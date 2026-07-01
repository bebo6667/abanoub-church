import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { uploadAnnouncementFile, type Announcement, type Attachment } from "@/lib/announcements";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { Plus, Loader2, Trash2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/announcements")({
  component: AdminAnnouncementsPage,
});

function AdminAnnouncementsPage() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: list } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data } = await db.from("announcements").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any as Announcement[];
    },
    enabled: isStaff,
  });

  function reset() {
    setTitle(""); setBody(""); setLink(""); setAttachments([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name}: أكبر من 50 ميجا`); continue; }
        uploaded.push(await uploadAnnouncementFile(f));
      }
      setAttachments((p) => [...p, ...uploaded]);
    } catch (e: any) {
      toast.error(e.message ?? "خطأ في الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!title.trim()) return toast.error("العنوان مطلوب");
    setSaving(true);
    const { error } = await db.from("announcements").insert({
      title: title.trim(),
      body: body.trim() || null,
      link_url: link.trim() || null,
      attachments: attachments as any,
      created_by: user!.id,
      is_published: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم نشر الإعلان");
    reset(); setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الإعلان؟")) return;
    const { error } = await db.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <AppShell title="الإعلانات" isAdmin>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">إدارة الإعلانات</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />إعلان جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>نشر إعلان جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm mb-1 block">العنوان</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإعلان" />
              </div>
              <div>
                <label className="text-sm mb-1 block">النص</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="محتوى الإعلان..." />
              </div>
              <div>
                <label className="text-sm mb-1 block">رابط (اختياري)</label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm mb-1 block">المرفقات (صور، فيديو، صوت، PDF)</label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={(e) => handleFiles(e.target.files)}
                  className="text-xs"
                />
                {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />جاري الرفع...</p>}
                {attachments.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-secondary/40 rounded p-2">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="flex-1 truncate">{a.name}</span>
                        <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={submit} disabled={saving || uploading}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}نشر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2 mb-6">
        {(list ?? []).map((a) => (
          <Card key={a.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.title}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ar-EG")}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
        {list && list.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد إعلانات</Card>
        )}
      </div>

      <div className="pt-4 border-t">
        <AnnouncementsFeed />
      </div>
    </AppShell>
  );
}
