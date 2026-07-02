import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BGlOgF0d29Ge13P_PKnlhkdXGA-0XzIZUcJToNMbsaNa4tNRHQSoFf_HW76ke2lqsHicjwgFuFr1rLSYdJFPOBE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export type PushStatus = "unsupported" | "denied" | "granted" | "default";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushStatus(): PushStatus {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushStatus;
}

export async function enablePush(userId: string): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm as PushStatus;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as any;
  const endpoint = sub.endpoint;
  const p256dh = json?.keys?.p256dh || bufToBase64(sub.getKey("p256dh"));
  const auth = json?.keys?.auth || bufToBase64(sub.getKey("auth"));

  await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint, p256dh, auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" },
  );

  return "granted";
}

export async function ensurePushIfGranted(userId: string) {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;
  try { await enablePush(userId); } catch { /* ignore */ }
}
