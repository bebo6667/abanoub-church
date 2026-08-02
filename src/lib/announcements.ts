import { supabase } from "@/integrations/supabase/client";

export type Attachment = { path: string; name: string; mime: string; kind: "image" | "video" | "audio" | "pdf" | "file" };

export type Poll = { question: string; options: string[] };

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  attachments: Attachment[];
  poll: Poll | null;
  created_by: string | null;
  is_published: boolean;
  created_at: string;
};

export function kindFromMime(mime: string): Attachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "file";
}

export function kindLabel(kind: Attachment["kind"]): string {
  switch (kind) {
    case "image": return "صورة";
    case "video": return "فيديو";
    case "audio": return "تسجيل صوتي";
    case "pdf": return "ملف PDF";
    default: return "ملف";
  }
}

export async function uploadAnnouncementFile(file: File): Promise<Attachment> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("announcements").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
  });
  if (error) throw error;
  return { path, name: file.name, mime: file.type || "application/octet-stream", kind: kindFromMime(file.type || "") };
}

/** Signed URL for private announcements bucket (1 day). */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("announcements").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}
