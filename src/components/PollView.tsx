import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BarChart3, Check } from "lucide-react";
import { toast } from "sonner";
import type { Poll } from "@/lib/announcements";

export function PollView({ announcementId, poll }: { announcementId: string; poll: Poll }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: votes } = useQuery({
    queryKey: ["announcement-votes", announcementId],
    queryFn: async () => {
      const { data } = await db.from("announcement_votes").select("user_id,option_index").eq("announcement_id", announcementId);
      return (data ?? []) as { user_id: string; option_index: number }[];
    },
  });

  const all = votes ?? [];
  const total = all.length;
  const mine = all.find((v) => v.user_id === user?.id);

  async function vote(index: number) {
    if (!user) return;
    const key = ["announcement-votes", announcementId];
    const prev = qc.getQueryData<{ user_id: string; option_index: number }[]>(key) ?? [];
    // تحديث فوري للنِّسب بدون إعادة تحميل
    qc.setQueryData(key, [
      ...prev.filter((v) => v.user_id !== user.id),
      { user_id: user.id, option_index: index },
    ]);
    const { error } = await db.from("announcement_votes").upsert(
      { announcement_id: announcementId, user_id: user.id, option_index: index },
      { onConflict: "announcement_id,user_id" },
    );
    if (error) {
      qc.setQueryData(key, prev);
      return toast.error("تعذر تسجيل صوتك: " + error.message);
    }
    toast.success(`تم تسجيل صوتك: ${poll.options[index]}`);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-secondary/20">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4 text-primary" />
        {poll.question || "تصويت"}
      </p>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = all.filter((v) => v.option_index === i).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const selected = mine?.option_index === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              className="relative w-full overflow-hidden rounded-md border text-right p-2 hover:bg-accent/30"
            >
              <span className="absolute inset-y-0 right-0 bg-primary/15" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5">
                  {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                  {opt}
                </span>
                <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">إجمالي الأصوات: {total}</p>
    </div>
  );
}
