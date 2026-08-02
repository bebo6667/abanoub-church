import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadAnnouncementFile, type Attachment } from "@/lib/announcements";

export function AudioRecorderButton({
  label = "تسجيل صوتي",
  fileName = "recording",
  onRecorded,
}: {
  label?: string;
  fileName?: string;
  onRecorded: (a: Attachment) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [percent, setPercent] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setSeconds(0);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const ext = mime.includes("webm") ? "webm" : "m4a";
          const file = new File([blob], `${fileName}-${Date.now()}.${ext}`, { type: mime });
          onRecorded(await uploadAnnouncementFile(file, setPercent));
          toast.success("تم رفع التسجيل الصوتي");
        } catch (e: any) {
          toast.error(e?.message ?? "تعذر رفع التسجيل");
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("تعذر الوصول إلى الميكروفون");
    }
  }

  function stop() {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={recording ? "destructive" : "outline"}
      disabled={busy}
      onClick={recording ? stop : start}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {busy ? "جاري الرفع..." : recording ? `إيقاف (${seconds}ث)` : label}
    </Button>
  );
}
