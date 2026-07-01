import { supabase } from "@/integrations/supabase/client";

export type InboxItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
};

export async function fetchInbox(userId: string, limit = 30): Promise<InboxItem[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as InboxItem[];
}

export async function markRead(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllRead(userId: string) {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export function subscribeInbox(userId: string, onInsert: (row: InboxItem) => void) {
  const ch = supabase
    .channel(`inbox-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as InboxItem),
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
