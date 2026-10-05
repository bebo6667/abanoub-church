import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Cross } from "lucide-react";
import { getLiturgicalDay, getUpcomingEvent, THEME_LABELS, type LiturgicalDay, type UpcomingEvent } from "@/lib/coptic-calendar";

export function CopticDayCard() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEvent | null>(null);
  useEffect(() => {
    const d = getLiturgicalDay();
    setDay(d);
    setUpcoming(getUpcomingEvent(d.date));
  }, []);
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

      <Link
        to="/dashboard/synaxarium"
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-background/70 px-3 py-2 text-sm font-bold transition hover:bg-accent/50"
      >
        <span className="flex items-center gap-2"><Cross className="h-4 w-4 text-primary" /> سنكسار اليوم وتفاصيل المناسبة</span>
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </Link>
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
