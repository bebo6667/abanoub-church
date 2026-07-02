import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";

export const Route = createFileRoute("/api/public/hooks/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { notification_id } = await request.json();
          if (!notification_id) return new Response("missing id", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: notif } = await supabaseAdmin
            .from("notifications")
            .select("id,user_id,title,body,url,type")
            .eq("id", notification_id)
            .maybeSingle();
          if (!notif) return new Response("not found", { status: 404 });

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id,endpoint,p256dh,auth")
            .eq("user_id", notif.user_id);

          if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { "content-type": "application/json" } });

          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT!,
            process.env.VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!,
          );

          const payload = JSON.stringify({
            title: notif.title,
            body: notif.body,
            url: notif.url || "/dashboard",
            tag: notif.type || undefined,
          });

          let sent = 0;
          const dead: string[] = [];
          await Promise.all(
            subs.map(async (s: any) => {
              try {
                await webpush.sendNotification(
                  { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                  payload,
                );
                sent++;
              } catch (err: any) {
                if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
              }
            }),
          );
          if (dead.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);

          return new Response(JSON.stringify({ sent, removed: dead.length }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          console.error("send-push error", e);
          return new Response(`err: ${e?.message || e}`, { status: 500 });
        }
      },
    },
  },
});
