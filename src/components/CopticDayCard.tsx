import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Cross, Loader2 } from "lucide-react";
import { getLiturgicalDay, getUpcomingEvent, THEME_LABELS, type LiturgicalDay, type UpcomingEvent } from "@/lib/coptic-calendar";
import { getSynaxarium } from "@/lib/api/synaxarium.functions";

export function CopticDayCard() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEvent | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = getLiturgicalDay();
    setDay(d);
    setUpcoming(getUpcomingEvent(d.date));
  }, []);
  const fetchSyn = useServerFn(getSynaxarium);
  const syn = useQuery({
    queryKey: ["synaxarium", day?.coptic.month, day?.coptic.day],
    queryFn: () => fetchSyn({ data: { month: day!.coptic.month, day: day!.coptic.day } }),
    enabled: !!day && open,
    staleTime: Infinity,
    retry: false,
  });
  if (!day) return null;
  const { coptic, fast, occasion } = day;

  return (
    <Card className="p-4 mb-4 border-primary/30 bg-gradient-to-br from-card to-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">التاريخ القبطي</p>
          <p className="font-display text-2xl font-bold text-primary">
            {coptic.day} {coptic.monthName} {coptic.year} ش
          </p>
          {occasion && <p className="mt-1 text-sm font-bold">✝ {occasion}</p>}
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground whitespace-nowrap">
          {THEME_LABELS[day.theme]}
        </span>
      </div>

      {fast && (
        <div className="mt-3 rounded-lg bg-background/70 p-3">
          <div className="flex justify-between text-sm font-bold">
            <span>{fast.name}</span>
            <span className="text-muted-foreground">{fast.total} يوم</span>
          </div>
          <Progress value={fast.percent} className="my-2 h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>مضى: <b className="text-foreground">{fast.passed}</b> يوم</span>
            <span>متبقي: <b className="text-foreground">{fast.remaining}</b> يوم</span>
          </div>
        </div>
      )}
      {!fast && day.isWedFriFast && (
        <p className="mt-2 text-xs text-muted-foreground">اليوم صوم (صوم الأربعاء والجمعة)</p>
      )}

      {upcoming && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {upcoming.kind === "fast" ? "🕯 الصوم القادم: " : "🎉 المناسبة القادمة: "}
              {upcoming.name}
            </p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary whitespace-nowrap">
              بعد {upcoming.daysLeft} {upcoming.daysLeft === 1 ? "يوم" : upcoming.daysLeft === 2 ? "يومين" : "أيام"}
            </span>
          </div>
          {upcoming.info && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{upcoming.info}</p>
          )}
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-background/70 px-3 py-2 text-sm font-bold">
        <span className="flex items-center gap-2"><Cross className="h-4 w-4 text-primary" /> سنكسار اليوم</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {syn.isLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> جاري تحميل السنكسار...</p>}
          {syn.error && <p className="text-xs text-destructive">{(syn.error as Error).message}</p>}
          {syn.data?.saints.map((s) => (
            <div key={s.name} className="rounded-lg border bg-card p-3">
              <p className="font-bold text-sm text-primary">{s.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.summary}</p>
            </div>
          ))}
          {syn.data && <p className="text-[10px] text-muted-foreground">الملخصات مكتوبة بالذكاء الاصطناعي.</p>}
        </div>
      )}
    </Card>
  );
}

/** Applies the liturgical color theme to the whole site. */
export function LiturgicalThemeApplier() {
  useEffect(() => {
    const t = getLiturgicalDay().theme;
    document.documentElement.dataset.liturgy = t;
  }, []);
  return null;
}
