import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, Loader2, Music4, Pencil, Save, X, ExternalLink, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/hymn/$name")({
  head: ({ params }) => {
    const n = decodeURIComponent(params.name);
    const t = `${n} — شرح اللحن وفيديو تعليمي`;
    const d = `تفسير ومعلومات وفيديو تعليمي للحن ${n} للشمامسة.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: HymnPage,
});

type Hymn = { name: string; explanation: string | null; info: string | null; video_url: string | null; video_path: string | null };

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

function HymnPage() {
  const { name: raw } = Route.useParams();
  const name = decodeURIComponent(raw);
  const { isStaff, user } = useAuth();
  const qc = useQueryClient();
  const key = ["hymn", name];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("hymn_details").select("*").eq("name", name).maybeSingle();
      if (error) throw error;
      let signed: string | null = null;
      if (data?.video_path) {
        const s = await supabase.storage.from("hymns").createSignedUrl(data.video_path, 3600);
        signed = s.data?.signedUrl ?? null;
      }
      return { hymn: data as Hymn | null, signed };
    },
  });

  const [editing, setEditing] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [info, setInfo] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = q.data?.hymn;
    setExplanation(h?.explanation ?? "");
    setInfo(h?.info ?? "");
    setVideoUrl(h?.video_url ?? "");
  }, [q.data, editing]);

  async function save() {
    setSaving(true);
    try {
      let video_path = removeVideo ? null : q.data?.hymn?.video_path ?? null;
      if (file) {
        if (!file.type.startsWith("video/")) throw new Error("الملف لازم يكون فيديو");
        const path = `${crypto.randomUUID()}.${file.name.split(".").pop() || "mp4"}`;
        const up = await supabase.storage.from("hymns").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        if (q.data?.hymn?.video_path) await supabase.storage.from("hymns").remove([q.data.hymn.video_path]);
        video_path = path;
      } else if (removeVideo && q.data?.hymn?.video_path) {
        await supabase.storage.from("hymns").remove([q.data.hymn.video_path]);
      }
      const { error } = await supabase.from("hymn_details").upsert({
        name,
        explanation: explanation.trim() || null,
        info: info.trim() || null,
        video_url: videoUrl.trim() || null,
        video_path,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("تم حفظ بيانات اللحن");
      setEditing(false); setFile(null); setRemoveVideo(false);
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const h = q.data?.hymn;
  const embed = h?.video_url ? embedUrl(h.video_url) : null;

  return (
    <AppShell>
      <div className="space-y-4" dir="rtl">
        <Link to="/dashboard/synaxarium" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> رجوع للسنكسار
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-bold"><Music4 className="h-5 w-5 text-primary" /> {name}</h1>
          {isStaff && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 ml-1" /> تعديل</Button>
          )}
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : editing ? (
          <Card className="space-y-3 p-4">
            <label className="block text-sm font-bold">تفسير اللحن</label>
            <Textarea rows={5} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="معنى كلمات اللحن وتفسيره..." />
            <label className="block text-sm font-bold">معلومات عن اللحن</label>
            <Textarea rows={4} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="متى يُقال، طريقة الأداء، النغمة..." />
            <label className="block text-sm font-bold">لينك فيديو تعليمي (يوتيوب أو أي رابط)</label>
            <Input dir="ltr" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
            <label className="block text-sm font-bold">أو ارفع فيديو تعليمي</label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {h?.video_path && !file && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removeVideo} onChange={(e) => setRemoveVideo(e.target.checked)} />
                <Trash2 className="h-4 w-4" /> حذف الفيديو المرفوع الحالي
              </label>
            )}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />} حفظ</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setFile(null); setRemoveVideo(false); }}><X className="h-4 w-4 ml-1" /> إلغاء</Button>
            </div>
          </Card>
        ) : (
          <>
            {(q.data?.signed || h?.video_url) ? (
              <Card className="space-y-3 p-3">
                <h2 className="font-bold">الفيديو التعليمي</h2>
                {q.data?.signed && <video src={q.data.signed} controls className="w-full rounded-lg" />}
                {embed && (
                  <div className="aspect-video w-full overflow-hidden rounded-lg">
                    <iframe src={embed} className="h-full w-full" allowFullScreen title={name} />
                  </div>
                )}
                {h?.video_url && !embed && (
                  <a href={h.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                    <ExternalLink className="h-4 w-4" /> فتح الفيديو التعليمي
                  </a>
                )}
              </Card>
            ) : null}
            <Card className="p-4">
              <h2 className="mb-2 font-bold">تفسير اللحن</h2>
              <p className="whitespace-pre-wrap text-sm leading-7">{h?.explanation || "لم يُضف تفسير بعد."}</p>
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 font-bold">معلومات عن اللحن</h2>
              <p className="whitespace-pre-wrap text-sm leading-7">{h?.info || "لم تُضف معلومات بعد."}</p>
            </Card>
            {!h && isStaff && <p className="text-center text-sm text-muted-foreground">اضغط «تعديل» لإضافة الشرح والفيديو.</p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
