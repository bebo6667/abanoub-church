import { useEffect, useState } from "react";
import { attachmentUrl, kindLabel, type Attachment } from "@/lib/announcements";
import { FileText, Download, Image as ImageIcon, Video, Mic, Paperclip, ExternalLink, Loader2 } from "lucide-react";

export function KindIcon({ kind, className = "h-4 w-4" }: { kind: Attachment["kind"]; className?: string }) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <Video className={className} />;
  if (kind === "audio") return <Mic className={className} />;
  if (kind === "pdf") return <FileText className={`${className} text-destructive`} />;
  return <Paperclip className={className} />;
}

export function useAttachmentUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null); setFailed(false);
    attachmentUrl(path)
      .then((u) => { if (alive) { if (u) setUrl(u); else setFailed(true); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);
  return { url, failed };
}

/** Rich preview of one attachment with type badge + open/download action. */
export function AttachmentPreview({ att, compact = false }: { att: Attachment; compact?: boolean }) {
  const { url, failed } = useAttachmentUrl(att.path);

  const header = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <KindIcon kind={att.kind} className="h-3.5 w-3.5" />
      <span className="font-medium">{kindLabel(att.kind)}</span>
      <span className="flex-1 truncate">{att.name}</span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Download className="h-3.5 w-3.5" />تنزيل
        </a>
      )}
    </div>
  );

  if (failed) {
    return (
      <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
        تعذر تحميل المرفق: {att.name}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-md border p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />جاري تحضير {kindLabel(att.kind)}...
      </div>
    );
  }

  return (
    <div className="rounded-md border p-2 space-y-2 bg-card">
      {header}
      {att.kind === "image" && (
        <img src={url} alt={att.name} loading="lazy" className={`w-full rounded object-contain bg-muted ${compact ? "max-h-40" : "max-h-96"}`} />
      )}
      {att.kind === "video" && <video src={url} controls className={`w-full rounded bg-black ${compact ? "max-h-40" : "max-h-96"}`} />}
      {att.kind === "audio" && <audio src={url} controls className="w-full" />}
      {(att.kind === "pdf" || att.kind === "file") && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded border hover:bg-accent/30 text-sm">
          <KindIcon kind={att.kind} className="h-5 w-5" />
          <span className="flex-1 truncate">{att.name}</span>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </a>
      )}
    </div>
  );
}
