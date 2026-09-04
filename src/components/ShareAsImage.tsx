import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function toPng(node: HTMLElement) {
  const { toBlob } = await import("html-to-image");
  const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
  const blob = await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: bg === "rgba(0, 0, 0, 0)" ? "#ffffff" : bg,
  });
  if (!blob) throw new Error("failed");
  return blob;
}

export function ShareAsImage({
  targetRef,
  fileName = "schedule.png",
  shareTitle = "جدول خدمة القداس",
}: {
  targetRef: RefObject<HTMLElement | null>;
  fileName?: string;
  shareTitle?: string;
}) {
  const [busy, setBusy] = useState<"share" | "save" | null>(null);

  async function run(mode: "share" | "save") {
    const node = targetRef.current;
    if (!node) return;
    setBusy(mode);
    try {
      const blob = await toPng(node);
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (mode === "share" && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: shareTitle, text: shareTitle });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("تم حفظ الجدول كصورة");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("تعذّر إنشاء الصورة، حاول مرة أخرى");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className="flex-1 gap-1" onClick={() => run("share")} disabled={!!busy}>
        {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        مشاركة كصورة
      </Button>
      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => run("save")} disabled={!!busy}>
        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        حفظ كصورة
      </Button>
    </div>
  );
}
