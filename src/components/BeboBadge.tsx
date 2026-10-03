import { useState } from "react";
import { X } from "lucide-react";

/**
 * شريط سفلي ثابت بتصميم زجاج سائل شفاف (Apple Liquid Glass).
 * شفاف تمامًا بحيث يظهر المحتوى الموجود تحته، ويختفي بضغطة X
 * ثم يعود للظهور تلقائيًا مع كل تحديث أو دخول جديد للموقع.
 */
export function BeboBadge() {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 right-4 z-[9999999] flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-200 hover:bg-white/20"
      style={{
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      <img
        src="/app-icon-192.png"
        alt="Bebo Nader"
        className="h-6 w-6 rounded-full object-cover ring-1 ring-white/40"
      />
      <span className="text-xs font-semibold tracking-wide text-neutral-900 drop-shadow-sm">
        Developer by Bebo Nader
      </span>
      <button
        type="button"
        aria-label="إخفاء الشريط"
        onClick={() => setHidden(true)}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-neutral-500 transition-all duration-200 hover:bg-white/40 hover:text-neutral-900"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
