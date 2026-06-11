import { supabase } from "@/integrations/supabase/client";
import { SERVICE_LABELS, formatFridayDate, type ServiceType } from "@/lib/services";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const p = await Notification.requestPermission();
  return p;
}

export function notify(title: string, body: string, url?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    if (url) n.onclick = () => { window.focus(); window.location.href = url; };
  } catch { /* ignore */ }
}

/** Subscribes to new assignments for the user; returns unsubscribe fn. */
export function subscribeAssignmentNotifications(userId: string) {
  const channel = supabase
    .channel(`assignments-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "schedule_assignments", filter: `user_id=eq.${userId}` },
      async (payload: any) => {
        const row = payload.new;
        const { data: sched } = await supabase
          .from("schedules")
          .select("friday_date,status,id")
          .eq("id", row.schedule_id)
          .maybeSingle();
        if (!sched || sched.status !== "published") return;
        const svc = SERVICE_LABELS[row.service_type as ServiceType] ?? row.service_type;
        notify(
          "خدمة جديدة مسندة إليك",
          `${svc} — ${formatFridayDate(sched.friday_date)}`,
          `/dashboard/schedule/${sched.id}`,
        );
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
