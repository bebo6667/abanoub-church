import { useState } from "react";
import { X } from "lucide-react";

/**
 * شارة "Edit with Bebo Nader" — قطرة زجاجية (Apple Liquid Glass / Lens).
 * شفافية عالية جدًا مع تأثير عدسة يُكبّر ما تحتها (backdrop saturate + brightness
 * + blur خفيف جدًا يعطي إحساس التكبير)، وبريق انكسار على الحواف مثل قطرة ماء.
 * تختفي بضغطة X وتعود للظهور مع كل تحديث أو دخول جديد.
 */
export function BeboBadge() {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 right-4 z-[9999999] select-none"
      style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.25))" }}
    >
      {/* قشرة القطرة — طبقة العدسة التي "تُكبّر" ما تحتها */}
      <div
        className="relative flex items-center gap-2 overflow-hidden rounded-full px-3 py-2 transition-transform duration-300 hover:scale-[1.03]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.08) 100%)",
          backdropFilter:
            "blur(1.5px) saturate(190%) brightness(1.12) contrast(1.06)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow:
            "inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(255,255,255,0.25), inset 0 0 12px rgba(255,255,255,0.08)",
        }}
      >
        {/* لمعة الانكسار العلوية — مثل انعكاس الضوء على القطرة */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-[2px] h-[38%] rounded-full"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.02))",
            filter: "blur(2px)",
          }}
        />
        {/* وميض قطري كالقطرات — highlight جانبي */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1 top-0 h-full w-8 -skew-x-12"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)",
            filter: "blur(3px)",
          }}
        />
        {/* توهج سفلي (caustic) كضوء يمر عبر القطرة */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-[1px] h-[30%] rounded-full"
          style={{
            background:
              "linear-gradient(0deg, rgba(255,255,255,0.30), rgba(255,255,255,0))",
            filter: "blur(2px)",
          }}
        />

        <img
          src="/app-icon-192.png"
          alt="Bebo Nader"
          className="relative h-6 w-6 rounded-full object-cover"
          style={{
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.6)",
          }}
        />
        <span
          className="relative text-xs font-semibold tracking-wide text-neutral-900"
          style={{
            textShadow:
              "0 1px 1px rgba(255,255,255,0.85), 0 0 6px rgba(255,255,255,0.45)",
          }}
        >
          Edit with Bebo Nader
        </span>
        <button
          type="button"
          aria-label="إخفاء الشارة"
          onClick={() => setHidden(true)}
          className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full text-neutral-700/80 transition-all duration-200 hover:bg-white/50 hover:text-neutral-900"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
