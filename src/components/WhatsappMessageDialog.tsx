import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { generateScheduleWhatsapp } from "@/lib/api/whatsapp-message.functions";

export function WhatsappMessageDialog({ scheduleId }: { scheduleId: string }) {
  const gen = useServerFn(generateScheduleWhatsapp);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const { text } = await gen({ data: { scheduleId, details } });
      setMessage(text);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء الرسالة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><MessageCircle className="h-4 w-4" />رسالة واتساب</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إنشاء رسالة واتساب للشمامسة</DialogTitle></DialogHeader>
        <label className="text-sm font-medium">تفاصيل إضافية (موعد الحضور، ملاحظات، الملابس...)</label>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000}
          placeholder="مثال: الحضور الساعة 7 صباحًا، رجاء إحضار التونية" />
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "جاري الإنشاء..." : message ? "إعادة الإنشاء" : "إنشاء الرسالة"}
        </Button>
        {message && (
          <>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={12} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(message); toast.success("تم النسخ"); }}>
                <Copy className="h-4 w-4" />نسخ
              </Button>
              <Button className="flex-1" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")}>
                <MessageCircle className="h-4 w-4" />إرسال عبر واتساب
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
