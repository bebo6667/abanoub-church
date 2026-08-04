/** Client-side compression helpers for oversized announcement attachments. */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** الصيغ المسموح برفعها في الإعلانات. */
export const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "heic", "bmp",
  "mp4", "webm", "mov", "m4v",
  "mp3", "wav", "m4a", "aac", "ogg", "oga",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip",
] as const;

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_EXACT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

export function extensionOf(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

/** يتحقق من الصيغة قبل الرفع؛ يعيد رسالة خطأ واضحة أو null إن كان الملف مقبولًا. */
export function validateFileType(file: File): string | null {
  const ext = extensionOf(file.name);
  const mime = (file.type || "").toLowerCase();
  const mimeOk = mime
    ? ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_EXACT.includes(mime)
    : false;
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  if (mimeOk || extOk) return null;
  return `${file.name}: صيغة غير مدعومة${ext ? ` (.${ext})` : ""} — المسموح: صور، فيديو، صوت، PDF، مستندات Office، نصوص، ZIP`;
}

/** تحقق كامل (صيغة + حجم). يعيد رسالة الخطأ أو null. */
export function validateFile(file: File, maxBytes = MAX_UPLOAD_BYTES): string | null {
  const typeError = validateFileType(file);
  if (typeError) return typeError;
  if (file.size === 0) return `${file.name}: الملف فارغ`;
  if (file.size > maxBytes) return `${file.name}: الحجم ${formatBytes(file.size)} أكبر من الحد ${formatBytes(maxBytes)}`;
  return null;
}

/** يقرأ أول بايتات الملف؛ يفشل لو الملف غير قابل للقراءة (تالف/محذوف/صلاحيات). */
async function readHead(file: File, bytes = 16): Promise<Uint8Array> {
  const buf = await file.slice(0, bytes).arrayBuffer();
  return new Uint8Array(buf);
}

function startsWith(head: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => head[offset + i] === b);
}

async function canDecodeImage(file: File): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(file);
    const ok = bmp.width > 0 && bmp.height > 0;
    bmp.close?.();
    return ok;
  } catch {
    return false;
  }
}

function canLoadMedia(file: File, tag: "video" | "audio"): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(tag) as HTMLMediaElement;
    const finish = (ok: boolean) => { URL.revokeObjectURL(url); resolve(ok); };
    const timer = setTimeout(() => finish(true), 8000); // لا نمنع الرفع لو تأخر الفحص
    el.preload = "metadata";
    el.onloadedmetadata = () => { clearTimeout(timer); finish(true); };
    el.onerror = () => { clearTimeout(timer); finish(false); };
    el.src = url;
  });
}

/**
 * تحقق عميق من سلامة الملف (ليس مجرد الحجم/الصيغة):
 * يقرأ محتوى الملف ويتأكد أنه قابل للفتح فعليًا.
 * يعيد رسالة خطأ واضحة أو null.
 */
export async function verifyFileIntegrity(file: File): Promise<string | null> {
  let head: Uint8Array;
  try {
    head = await readHead(file, 16);
  } catch {
    return `${file.name}: تعذر قراءة الملف — قد يكون تالفًا أو تم نقله/حذفه`;
  }
  if (!head.length) return `${file.name}: الملف تالف أو فارغ`;

  const ext = extensionOf(file.name);
  const mime = (file.type || "").toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") {
    if (!startsWith(head, [0x25, 0x50, 0x44, 0x46])) return `${file.name}: ملف PDF تالف أو غير صالح`;
  }

  const zipLike = ["zip", "docx", "xlsx", "pptx"].includes(ext);
  if (zipLike && !startsWith(head, [0x50, 0x4b])) {
    return `${file.name}: الملف تالف أو غير قابل للقراءة`;
  }

  if (mime.startsWith("image/") && ext !== "heic") {
    if (!(await canDecodeImage(file))) return `${file.name}: الصورة تالفة أو غير قابلة للعرض`;
  } else if (mime.startsWith("video/")) {
    if (!(await canLoadMedia(file, "video"))) return `${file.name}: الفيديو تالف أو بترميز غير مدعوم`;
  } else if (mime.startsWith("audio/")) {
    if (!(await canLoadMedia(file, "audio"))) return `${file.name}: الملف الصوتي تالف أو غير قابل للتشغيل`;
  }

  // فحص أخير: قراءة كامل الملف للملفات الصغيرة للتأكد من عدم وجود خطأ قراءة
  if (file.size <= 8 * 1024 * 1024) {
    try {
      await file.slice(0, file.size).arrayBuffer();
    } catch {
      return `${file.name}: تعذر قراءة محتوى الملف — قد يكون تالفًا`;
    }
  }

  return null;
}

/** تحقق كامل غير متزامن: الصيغة + الحجم + سلامة المحتوى. */
export async function validateFileDeep(file: File, maxBytes = MAX_UPLOAD_BYTES): Promise<string | null> {
  return validateFile(file, maxBytes) ?? (await verifyFileIntegrity(file));
}


export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجا`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلو`;
}

export function canCompress(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

/** Downscale + re-encode an image to JPEG until it fits under maxBytes. */
export async function compressImage(
  file: File,
  maxBytes = MAX_UPLOAD_BYTES,
  onProgress?: (p: number) => void,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let scale = 1;
  let quality = 0.82;

  for (let attempt = 0; attempt < 6; attempt++) {
    onProgress?.(Math.round(((attempt + 1) / 6) * 100));
    const w = Math.max(320, Math.round(bitmap.width * scale));
    const h = Math.max(320, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) break;
    if (blob.size <= maxBytes) {
      bitmap.close?.();
      onProgress?.(100);
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-compressed.jpg`, { type: "image/jpeg" });
    }
    scale *= 0.75;
    quality = Math.max(0.5, quality - 0.08);
  }
  bitmap.close?.();
  throw new Error("تعذر ضغط الصورة بما يكفي");
}

/** Re-encode a video at lower resolution/bitrate using canvas + MediaRecorder (real-time). */
export async function compressVideo(
  file: File,
  maxBytes = MAX_UPLOAD_BYTES,
  onProgress?: (p: number) => void,
): Promise<File> {
  if (typeof MediaRecorder === "undefined") throw new Error("المتصفح لا يدعم ضغط الفيديو");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  (video as any).playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("تعذر قراءة الفيديو"));
  });

  const duration = video.duration || 0;
  if (!duration || !isFinite(duration)) {
    URL.revokeObjectURL(url);
    throw new Error("تعذر قراءة مدة الفيديو");
  }

  // Target bitrate so the output lands comfortably under the limit.
  const targetBits = Math.floor((maxBytes * 0.85 * 8) / duration);
  const videoBitsPerSecond = Math.max(300_000, Math.min(2_500_000, targetBits - 64_000));

  const maxSide = 720;
  const ratio = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * ratio) || 640;
  canvas.height = Math.round(video.videoHeight * ratio) || 360;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(24);
  try {
    const src = (video as any).captureStream?.() as MediaStream | undefined;
    src?.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    /* audio optional */
  }

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond, audioBitsPerSecond: 64_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  rec.start(1000);
  video.muted = false;
  await video.play().catch(() => video.play());

  let raf = 0;
  const draw = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onProgress?.(Math.min(99, Math.round((video.currentTime / duration) * 100)));
    raf = requestAnimationFrame(draw);
  };
  draw();

  await new Promise<void>((resolve) => { video.onended = () => resolve(); });
  cancelAnimationFrame(raf);
  rec.stop();
  await done;
  URL.revokeObjectURL(url);

  const ext = mime.includes("webm") ? "webm" : "mp4";
  const type = mime.split(";")[0];
  const blob = new Blob(chunks, { type });
  onProgress?.(100);
  if (blob.size > maxBytes) throw new Error("الفيديو ما زال أكبر من 50 ميجا بعد الضغط");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-compressed.${ext}`, { type });
}

export async function compressFile(
  file: File,
  onProgress?: (p: number) => void,
): Promise<File> {
  if (file.type.startsWith("image/")) return compressImage(file, MAX_UPLOAD_BYTES, onProgress);
  if (file.type.startsWith("video/")) return compressVideo(file, MAX_UPLOAD_BYTES, onProgress);
  throw new Error("لا يمكن ضغط هذا النوع من الملفات");
}
