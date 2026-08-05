import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { toast } from "sonner";

export const REACTIONS = [
  { emoji: "👍", label: "لايك" },
  { emoji: "❤️", label: "أحببته" },
  { emoji: "😂", label: "ضحكة" },
  { emoji: "😮", label: "مندهش" },
  { emoji: "🙏", label: "صلاة" },
  { emoji: "😢", label: "حزين" },
] as const;

type Reaction = { user_id: string; emoji: string };
type ViewRow = { user_id: string; viewed_at: string };

/** يسجّل مشاهدة الإعلان مرة واحدة لكل عضو */
function useMarkViewed(announcementId: string) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await db
        .from("announcement_views")
        .upsert(
          { announcement_id: announcementId, user_id: user.id },
          { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [announcementId, user]);
}

export function AnnouncementEngagement({ announcementId }: { announcementId: string }) {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  useMarkViewed(announcementId);

  const { data: reactions } = useQuery({
    queryKey: ["announcement-reactions", announcementId],
    queryFn: async () => {
      const { data } = await db
        .from("announcement_reactions")
        .select("user_id,emoji")
        .eq("announcement_id", announcementId);
      return (data ?? []) as Reaction[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${announcementId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcement_reactions",
          filter: `announcement_id=eq.${announcementId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["announcement-reactions", announcementId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [announcementId, qc]);

  const all = reactions ?? [];
  const mine = all.find((r) => r.user_id === user?.id);

  async function react(emoji: string) {
    if (!user) return;
    const key = ["announcement-reactions", announcementId];
    const prev = qc.getQueryData<Reaction[]>(key) ?? [];
    const remove = mine?.emoji === emoji;
    qc.setQueryData(
      key,
      remove ? prev.filter((r) => r.user_id !== user.id) : [...prev.filter((r) => r.user_id !== user.id), { user_id: user.id, emoji }],
    );
    const { error } = remove
      ? await db.from("announcement_reactions").delete().eq("announcement_id", announcementId).eq("user_id", user.id)
      : await db
          .from("announcement_reactions")
          .upsert({ announcement_id: announcementId, user_id: user.id, emoji }, { onConflict: "announcement_id,user_id" });
    if (error) {
      qc.setQueryData(key, prev);
      return toast.error("تعذر تسجيل التفاعل: " + error.message);
    }
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
      {REACTIONS.map(({ emoji, label }) => {
        const count = all.filter((r) => r.emoji === emoji).length;
        const active = mine?.emoji === emoji;
        return (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            title={label}
            aria-label={label}
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm transition ${
              active ? "border-primary bg-primary/10" : "hover:bg-accent/30"
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-[11px] text-muted-foreground">{count}</span>}
          </button>
        );
      })}
      {isStaff && <ViewersDialog announcementId={announcementId} />}
    </div>
  );
}

function ViewersDialog({ announcementId }: { announcementId: string }) {
  const [open, setOpen] = useState(false);

  const { data: views } = useQuery({
    queryKey: ["announcement-views", announcementId],
    queryFn: async () => {
      const { data } = await db
        .from("announcement_views")
        .select("user_id,viewed_at")
        .eq("announcement_id", announcementId)
        .order("viewed_at", { ascending: false });
      return (data ?? []) as ViewRow[];
    },
  });

  const { data: people } = useQuery({
    enabled: open,
    queryKey: ["announcement-viewers-profiles", announcementId],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id,full_name,phone,whatsapp").eq("status", "approved");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const rows = views ?? [];
  const nameOf = (id: string) => people?.find((p) => p.id === id)?.full_name || "عضو";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ms-auto h-8 gap-1 text-xs">
          <Eye className="h-4 w-4" />
          {rows.length} مشاهدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>من شاهد الإعلان ({rows.length})</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مشاهدات بعد</p>
          ) : (
            rows.map((v) => (
              <div key={v.user_id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="font-medium">{nameOf(v.user_id)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(v.viewed_at).toLocaleString("ar-EG")}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
