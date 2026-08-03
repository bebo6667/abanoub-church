/** Client-side compression helpers for oversized announcement attachments. */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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
