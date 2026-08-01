import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { attachmentUrl, type Announcement, type Attachment } from "@/lib/announcements";
import { FileText, ExternalLink, Megaphone, Download } from "lucide-react";

export function AnnouncementsFeed() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await db
        .from("announcements")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any as Announcement[];
    },
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />الإعلانات</h2>
      {!data || data.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد إعلانات حالياً</Card>
      ) : (
        data.map((a) => <AnnouncementCard key={a.id} a={a} />)
      )}
    </section>
  );
}

function AnnouncementCard({ a }: { a: Announcement }) {
  return (
    <Card className="p-4 space-y-2">
      <div>
        <h3 className="font-bold text-base">{a.title}</h3>
        <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ar-EG")}</p>
      </div>
      {a.body && <p className="text-sm whitespace-pre-wrap leading-relaxed">{a.body}</p>}
      {a.link_url && (
        <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">
          <ExternalLink className="h-3.5 w-3.5" />{a.link_url}
        </a>
      )}
      {a.poll && Array.isArray(a.poll.options) && a.poll.options.length > 0 && (
        <PollView announcementId={a.id} poll={a.poll} />
      )}
      {(a.attachments ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-2 mt-2">
          {(a.attachments ?? []).map((att, i) => <AttachmentView key={i} att={att} />)}
        </div>
      )}
    </Card>
  );
}

function AttachmentView({ att }: { att: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    attachmentUrl(att.path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [att.path]);

  if (!url) return <div className="h-24 rounded bg-muted animate-pulse" />;
  if (att.kind === "image") return <img src={url} alt={att.name} className="w-full rounded max-h-96 object-contain bg-muted" />;
  if (att.kind === "video") return <video src={url} controls className="w-full rounded max-h-96 bg-black" />;
  if (att.kind === "audio") return <audio src={url} controls className="w-full" />;
  if (att.kind === "pdf") return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded border hover:bg-accent/30">
      <FileText className="h-5 w-5 text-destructive" />
      <span className="text-sm flex-1 truncate">{att.name}</span>
      <Download className="h-4 w-4 text-muted-foreground" />
    </a>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded border hover:bg-accent/30">
      <FileText className="h-5 w-5" />
      <span className="text-sm flex-1 truncate">{att.name}</span>
      <Download className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
