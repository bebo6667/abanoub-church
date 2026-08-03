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
import { uploadAnnouncementFile, type Announcement, type Attachment, type Poll } from "@/lib/announcements";
import { MAX_UPLOAD_BYTES, canCompress, compressFile, formatBytes, validateFileType, validateFile } from "@/lib/compress";

import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { AudioRecorderButton } from "@/components/AudioRecorderButton";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, Trash2, Paperclip, X, Image as ImageIcon, LinkIcon, BarChart3, RefreshCw, FileArchive } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/announcements")({
  component: AdminAnnouncementsPage,
});
type OversizedFile = { file: File; replaceIndex: number | null };

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
  const [showLink, setShowLink] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number }[]>([]);
  const [oversized, setOversized] = useState<OversizedFile[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  function setPercent(name: string, percent: number) {
    setProgress((p) => p.map((x) => (x.name === name ? { ...x, percent } : x)));
  }

  async function uploadInto(list: File[], replaceIdx: number | null) {
    // حارس أخير قبل الحفظ: أي ملف غير مطابق يُرفض برسالة واضحة
    const invalid = list.map((f) => validateFile(f)).find(Boolean);
    if (invalid) return toast.error(invalid);
    setUploading(true);
    setProgress(list.map((f) => ({ name: f.name, percent: 0 })));

    try {
      const uploaded: Attachment[] = [];
      for (const f of list) uploaded.push(await uploadAnnouncementFile(f, (p) => setPercent(f.name, p)));
      if (replaceIdx !== null) {
        setAttachments((p) => p.map((x, j) => (j === replaceIdx ? uploaded[0] : x)));
        toast.success("تم استبدال المرفق");
      } else {
        setAttachments((p) => [...p, ...uploaded]);
        toast.success(`تم رفع ${uploaded.length} ملف`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ في الرفع");
    } finally {
      setUploading(false);
      setProgress([]);
    }
  }

  /** يتحقق من الصيغة أولًا، ثم يفصل الملفات الكبيرة لاقتراح الضغط. */
  function triage(files: File[], replaceIdx: number | null) {
    const ok: File[] = [];
    const big: OversizedFile[] = [];
    for (const f of files) {
      const typeError = validateFileType(f);
      if (typeError) { toast.error(typeError); continue; }
      if (f.size === 0) { toast.error(`${f.name}: الملف فارغ`); continue; }
      if (f.size > MAX_UPLOAD_BYTES) big.push({ file: f, replaceIndex: replaceIdx });
      else ok.push(f);
    }
    if (big.length) setOversized((p) => [...p, ...big]);
    return ok;
  }


  async function compressAndUpload(item: OversizedFile) {
    setOversized((p) => p.filter((x) => x !== item));
    if (!canCompress(item.file)) return toast.error("لا يمكن ضغط هذا النوع، اختر ملفًا أصغر من 50 ميجا");
    setUploading(true);
    setProgress([{ name: `ضغط ${item.file.name}`, percent: 0 }]);
    try {
      const smaller = await compressFile(item.file, (p) => setPercent(`ضغط ${item.file.name}`, p));
      toast.success(`تم الضغط: ${formatBytes(item.file.size)} ← ${formatBytes(smaller.size)}`);
      setUploading(false);
      setProgress([]);
      await uploadInto([smaller], item.replaceIndex);
    } catch (e: any) {
      setUploading(false);
      setProgress([]);
      toast.error(e?.message ?? "تعذر ضغط الملف");
    }
  }

  async function handleReplace(files: FileList | null) {
    const f = files?.[0];
    const idx = replaceIndex;
    if (replaceRef.current) replaceRef.current.value = "";
    setReplaceIndex(null);
    if (!f || idx === null) return;
    const ok = triage([f], idx);
    if (ok.length) await uploadInto(ok, idx);
  }

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
    setShowLink(false); setPollOn(false); setPollQuestion(""); setPollOptions(["", ""]);
    setProgress([]); setOversized([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const ok = triage(Array.from(files), null);
    if (fileRef.current) fileRef.current.value = "";
    if (imageRef.current) imageRef.current.value = "";
    if (ok.length) await uploadInto(ok, null);
  }



  async function submit() {
    if (!title.trim()) return toast.error("العنوان مطلوب");
    let poll: Poll | null = null;
    if (pollOn) {
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return toast.error("التصويت يحتاج خيارين على الأقل");
      poll = { question: pollQuestion.trim() || title.trim(), options: opts };
    }
    setSaving(true);
    const { error } = await db.from("announcements").insert({
      title: title.trim(),
      body: body.trim() || null,
      link_url: link.trim() || null,
      attachments: attachments as any,
      poll: poll as any,
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
                <div className="mt-2">
                  <AudioRecorderButton
                    label="تسجيل صوتي للعنوان"
                    fileName="title-voice"
                    onRecorded={(a) => setAttachments((p) => [...p, { ...a, name: "تسجيل العنوان" }])}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm mb-1 block">النص</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="محتوى الإعلان..." />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => imageRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" />صورة / فيديو
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />ملف
                </Button>
                <AudioRecorderButton fileName="voice" onRecorded={(a) => setAttachments((p) => [...p, a])} />
                <Button type="button" size="sm" variant={showLink ? "secondary" : "outline"} onClick={() => setShowLink((v) => !v)}>
                  <LinkIcon className="h-4 w-4" />لينك
                </Button>
                <Button type="button" size="sm" variant={pollOn ? "secondary" : "outline"} onClick={() => setPollOn((v) => !v)}>
                  <BarChart3 className="h-4 w-4" />تصويت
                </Button>
              </div>

              <input ref={imageRef} type="file" multiple accept="image/*,video/*" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
              <input ref={fileRef} type="file" multiple accept="*/*" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
              <input ref={replaceRef} type="file" accept="*/*" onChange={(e) => handleReplace(e.target.files)} className="hidden" />

              {showLink && (
                <div>
                  <label className="text-sm mb-1 block">رابط</label>
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
                </div>
              )}

              {pollOn && (
                <div className="rounded-lg border p-3 space-y-2">
                  <label className="text-sm block">سؤال التصويت</label>
                  <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="مثال: هل ستحضر الاجتماع؟" />
                  {pollOptions.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={o}
                        onChange={(e) => setPollOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder={`الخيار ${i + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <button type="button" onClick={() => setPollOptions((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => setPollOptions((p) => [...p, ""])}>
                    <Plus className="h-4 w-4" />إضافة خيار
                  </Button>
                </div>
              )}

              <div>
                {progress.length > 0 && (
                  <div className="space-y-2 mt-2 rounded-md border p-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />جاري الرفع...</p>
                    {progress.map((f) => (
                      <div key={f.name} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-muted-foreground">{f.percent}%</span>
                        </div>
                        <Progress value={f.percent} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
                {uploading && progress.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />جاري الرفع...</p>
                )}
                {attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-muted-foreground">المرفقات ({attachments.length}) — يمكنك المعاينة أو الاستبدال أو الحذف قبل النشر</p>
                    {attachments.map((a, i) => (
                      <div key={`${a.path}-${i}`} className="space-y-1">
                        <AttachmentPreview att={a} compact />
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => { setReplaceIndex(i); replaceRef.current?.click(); }}>
                            <RefreshCw className="h-3.5 w-3.5" />استبدال
                          </Button>
                          {a.kind === "audio" && (
                            <AudioRecorderButton
                              label="إعادة التسجيل"
                              fileName="voice"
                              onRecorded={(n) => setAttachments((p) => p.map((x, j) => (j === i ? { ...n, name: x.name } : x)))}
                            />
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>
                            <X className="h-3.5 w-3.5 text-destructive" />حذف
                          </Button>
                        </div>
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

        <Dialog open={oversized.length > 0} onOpenChange={(v) => { if (!v) setOversized([]); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>الملف أكبر من 50 ميجا</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                يمكن ضغط الملف داخل المتصفح قبل الإرسال. ضغط الفيديو يستغرق وقتًا بقدر مدة الفيديو تقريبًا.
              </p>
              {oversized.map((o, i) => (
                <div key={`${o.file.name}-${i}`} className="rounded-md border p-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{o.file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(o.file.size)}</span>
                  </div>
                  {canCompress(o.file) ? (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={uploading} onClick={() => compressAndUpload(o)}>
                        <FileArchive className="h-4 w-4" />ضغط وإرسال
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOversized((p) => p.filter((x) => x !== o))}>
                        <X className="h-4 w-4" />تجاهل
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">لا يمكن ضغط هذا النوع من الملفات، اختر ملفًا أصغر.</p>
                  )}
                </div>
              ))}
            </div>
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
