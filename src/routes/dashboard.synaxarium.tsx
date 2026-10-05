import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  COPTIC_MONTHS, THEME_LABELS, cairoToday, toCoptic, fromCoptic,
  getLiturgicalDay, getOccasionDetails,
} from "@/lib/coptic-calendar";
import { getSynaxarium } from "@/lib/api/synaxarium.functions";
import { ChevronLeft, ChevronRight, Cross, Loader2, Music4, Flame } from "lucide-react";

export const Route = createFileRoute("/dashboard/synaxarium")({
  head: () => ({
    meta: [
      { title: "السنكسار ودليل المناسبة — خدمة قداس الجمعة" },
      { name: "description", content: "تذكارات السنكسار القبطي لكل يوم مع تفاصيل الصوم والمناسبة والألحان الطقسية." },
      { property: "og:title", content: "السنكسار ودليل المناسبة — خدمة قداس الجمعة" },
      { property: "og:description", content: "تذكارات السنكسار القبطي لكل يوم مع تفاصيل الصوم والمناسبة والألحان الطقسية." },
    ],
  }),
  component: SynaxariumPage,
});

function SynaxariumPage() {
  const today = useMemo(() => toCoptic(cairoToday()), []);
  const [month, setMonth] = useState(today.month);
  const [day, setDay] = useState(today.day);

  const daysInMonth = month === 13 ? 6 : 30;
  const gregDate = useMemo(() => fromCoptic(today.year, month, day), [today.year, month, day]);
  const litDay = useMemo(() => getLiturgicalDay(gregDate), [gregDate]);
  const details = getOccasionDetails(litDay);

  const fetchSyn = useServerFn(getSynaxarium);
  const syn = useQuery({
    queryKey: ["synaxarium", month, day],
    queryFn: () => fetchSyn({ data: { month, day } }),
    staleTime: Infinity,
    retry: false,
  });

  const prev = () => {
    if (day > 1) setDay(day - 1);
    else { const m = month === 1 ? 13 : month - 1; setMonth(m); setDay(m === 13 ? 6 : 30); }
  };
  const next = () => {
    if (day < daysInMonth) setDay(day + 1);
    else { setMonth(month === 13 ? 1 : month + 1); setDay(1); }
  };

  return (
    <AppShell title="السنكسار ودليل المناسبة">
      {/* Day navigator */}
      <Card className="p-4 mb-4 border-primary/30 bg-gradient-to-br from-card to-accent/40">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={next} aria-label="اليوم التالي">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">{day} {COPTIC_MONTHS[month - 1]}</p>
            <p className="text-xs text-muted-foreground">{litDay.coptic.year} ش — {THEME_LABELS[litDay.theme]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={prev} aria-label="اليوم السابق">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={month}
            onChange={(e) => { const m = Number(e.target.value); setMonth(m); setDay((d) => Math.min(d, m === 13 ? 6 : 30)); }}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {COPTIC_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {(month !== today.month || day !== today.day) && (
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => { setMonth(today.month); setDay(today.day); }}>
            العودة إلى اليوم الحالي
          </Button>
        )}
      </Card>

      {/* Occasion / fast details */}
      {details && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">{details.name}</h2>
          </div>
          {details.info && <p className="text-sm leading-relaxed text-muted-foreground">{details.info}</p>}
          {litDay.fast && (
            <div className="mt-3 rounded-lg bg-background/70 p-3">
              <div className="flex justify-between text-sm font-bold">
                <span>أيام الصوم</span>
                <span className="text-muted-foreground">{litDay.fast.total} يوم</span>
              </div>
              <Progress value={litDay.fast.percent} className="my-2 h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>مضى: <b className="text-foreground">{litDay.fast.passed}</b> يوم</span>
                <span>متبقي: <b className="text-foreground">{litDay.fast.remaining}</b> يوم</span>
              </div>
            </div>
          )}
          {details.hymns.length > 0 && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-sm font-bold mb-2">
                <Music4 className="h-4 w-4 text-primary" /> ألحان المناسبة
              </p>
              <ul className="space-y-1.5">
                {details.hymns.map((h) => (
                  <li key={h} className="rounded-lg border bg-card px-3 py-2 text-sm">{h}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Synaxarium */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Cross className="h-5 w-5 text-primary" /> تذكارات اليوم
        </h2>
        {syn.isLoading && (
          <Card className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل السنكسار...
          </Card>
        )}
        {syn.error && <Card className="p-4 text-sm text-destructive">{(syn.error as Error).message}</Card>}
        {syn.data?.saints.map((s) => (
          <Card key={s.name} className="p-4">
            <p className="font-bold text-primary">{s.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
          </Card>
        ))}
        {syn.data && syn.data.saints.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد تذكارات مسجلة لهذا اليوم</Card>
        )}
        {syn.data && <p className="text-[10px] text-muted-foreground">الملخصات مكتوبة بالذكاء الاصطناعي وتحتاج مراجعة كنسية.</p>}
      </section>
    </AppShell>
  );
}
