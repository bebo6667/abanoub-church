import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import type { Announcement } from "@/lib/announcements";
import { ExternalLink, Megaphone, LinkIcon } from "lucide-react";
import { PollView } from "@/components/PollView";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { AnnouncementEngagement } from "@/components/AnnouncementEngagement";

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
  const atts = a.attachments ?? [];
  return (
    <Card className="p-4 space-y-2">
      <div>
        <h3 className="font-bold text-base">{a.title}</h3>
        <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ar-EG")}</p>
      </div>
      {a.body && <p className="text-sm whitespace-pre-wrap leading-relaxed">{a.body}</p>}
      {a.link_url && (
        <a
          href={a.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/30"
        >
          <LinkIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] text-muted-foreground">رابط خارجي</span>
            <span className="block text-sm text-primary truncate">{a.link_url}</span>
          </span>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        </a>
      )}
      {a.poll && Array.isArray(a.poll.options) && a.poll.options.length > 0 && (
        <PollView announcementId={a.id} poll={a.poll} />
      )}
      {atts.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mt-2">
          {atts.map((att, i) => <AttachmentPreview key={`${att.path}-${i}`} att={att} />)}
        </div>
      )}
    </Card>
  );
}
