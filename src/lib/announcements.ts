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

/** Uploads a file, reporting progress 0..100 when the browser supports it. */
export async function uploadAnnouncementFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Attachment> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "application/octet-stream";
  const meta = { path, name: file.name, mime: contentType, kind: kindFromMime(file.type || "") } as Attachment;

  onProgress?.(0);

  // Signed upload URL + XHR gives us real progress events.
  if (onProgress && typeof XMLHttpRequest !== "undefined") {
    const { data: signed } = await supabase.storage.from("announcements").createSignedUploadUrl(path);
    if (signed?.signedUrl) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.signedUrl, true);
        xhr.setRequestHeader("content-type", contentType);
        xhr.setRequestHeader("cache-control", "3600");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("فشل رفع الملف")));
        xhr.onerror = () => reject(new Error("فشل الاتصال أثناء الرفع"));
        xhr.send(file);
      });
      onProgress(100);
      return meta;
    }
  }

  const { error } = await supabase.storage.from("announcements").upload(path, file, {
    contentType,
    cacheControl: "3600",
  });
  if (error) throw error;
  onProgress?.(100);
  return meta;
}

/** Signed URL for private announcements bucket (1 day). */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("announcements").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}
