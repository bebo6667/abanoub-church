import { useEffect, useState } from "react";
import { X } from "lucide-react";

const HIDDEN_KEY = "bebo-badge-hidden";

/**
 * شريط سفلي ثابت بتصميم زجاجي فخم (Premium Glassmorphism).
 * يظهر أسفل يمين الشاشة في كل الصفحات، ويُخفى نهائيًا بضغطة X
 * (يُحفظ الاختيار في localStorage حتى لا يظهر مجددًا لنفس المستخدم).
 */
export function BeboBadge() {
  // نبدأ مخفيًا ثم نقرأ localStorage بعد التركيب (توافق مع SSR)
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(window.localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* تجاهل */
    }
    setHidden(true);
  };

  if (!mounted || hidden) return null;

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 right-4 z-[9999999] flex items-center gap-2 rounded-full border border-white/15 bg-neutral-950/40 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur-xl transition-colors duration-200 hover:bg-neutral-950/55"
    >
      <img
        src="/app-icon-192.png"
        alt="Bebo Nader"
        className="h-6 w-6 rounded-full object-cover ring-1 ring-white/20"
      />
      <span className="text-xs font-semibold tracking-wide text-neutral-100">
        Edit with Bebo Nader
      </span>
      <button
        type="button"
        aria-label="إخفاء الشريط"
        onClick={dismiss}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-neutral-400 transition-all duration-200 hover:bg-white/15 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
