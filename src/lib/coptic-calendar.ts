// Coptic calendar engine: Coptic date, feasts, fasts and liturgical season — computed locally.

export const COPTIC_MONTHS = [
  "توت", "بابه", "هاتور", "كيهك", "طوبة", "أمشير",
  "برمهات", "برمودة", "بشنس", "بؤونة", "أبيب", "مسرى", "النسيء",
];

export type LiturgicalTheme = "annual" | "fast" | "passion" | "festive" | "kiahk";

export const THEME_LABELS: Record<LiturgicalTheme, string> = {
  annual: "الطقس السنوي",
  fast: "الطقس الصومي",
  passion: "طقس أسبوع الآلام",
  festive: "الطقس الفرايحي",
  kiahk: "الطقس الكيهكي",
};

const DAY = 86400000;

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}
function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

/** Today's date in Cairo as a UTC-midnight Date. */
export function cairoToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  return utc(y, m, d);
}

function gregorianToJdn(y: number, m: number, d: number) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
function copticToJdn(y: number, m: number, d: number) {
  return 1825029 + 365 * (y - 1) + Math.floor(y / 4) + 30 * (m - 1) + d;
}

/** Converts a Coptic date to a Gregorian UTC-midnight Date. */
export function fromCoptic(year: number, month: number, day: number): Date {
  let jdn = copticToJdn(year, month, day);
  // JDN -> Gregorian (Fliegel-Van Flandern)
  const l = jdn + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l1 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l1 + 1)) / 1461001);
  const l2 = l1 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l2) / 2447);
  const d = l2 - Math.floor((2447 * j) / 80);
  const l3 = Math.floor(j / 11);
  const m = j + 2 - 12 * l3;
  const y = 100 * (n - 49) + i + l3;
  return utc(y, m, d);
}

export function toCoptic(date: Date) {
  const jdn = gregorianToJdn(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const year = Math.floor((4 * (jdn - 1825030) + 1463) / 1461);
  const month = Math.floor((jdn - copticToJdn(year, 1, 1)) / 30) + 1;
  const day = jdn - copticToJdn(year, month, 1) + 1;
  return { year, month, day, monthName: COPTIC_MONTHS[month - 1] };
}

/** Coptic (Orthodox) Easter in Gregorian calendar. Valid 1900–2099. */
export function copticEaster(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(utc(year, month, day), 13);
}

export type Fast = { name: string; start: Date; end: Date; total: number; passed: number; remaining: number; percent: number };

function fastRanges(year: number): { name: string; start: Date; end: Date }[] {
  const easter = copticEaster(year);
  const ranges = [
    { name: "صوم يونان (نينوى)", start: addDays(easter, -69), end: addDays(easter, -67) },
    { name: "الصوم الكبير المقدس", start: addDays(easter, -55), end: addDays(easter, -1) },
    { name: "صوم السيدة العذراء", start: utc(year, 8, 7), end: utc(year, 8, 21) },
    { name: "صوم الميلاد المجيد", start: utc(year, 11, 25), end: utc(year + 1, 1, 6) },
  ];
  const apostlesStart = addDays(easter, 50);
  const apostlesEnd = utc(year, 7, 11);
  if (apostlesStart <= apostlesEnd) ranges.push({ name: "صوم الرسل الأطهار", start: apostlesStart, end: apostlesEnd });
  return ranges;
}

export function currentFast(date: Date): Fast | null {
  const y = date.getUTCFullYear();
  for (const r of [...fastRanges(y - 1), ...fastRanges(y)]) {
    if (date >= r.start && date <= r.end) {
      const total = diffDays(r.end, r.start) + 1;
      const passed = diffDays(date, r.start) + 1;
      const remaining = total - passed;
      return { ...r, total, passed, remaining, percent: Math.round((passed / total) * 100) };
    }
  }
  return null;
}

function fixedFeast(date: Date, coptic: { month: number; day: number }): string | null {
  const m = date.getUTCMonth() + 1, d = date.getUTCDate();
  const g: Record<string, string> = {
    "1-7": "عيد الميلاد المجيد", "1-14": "عيد الختان", "1-19": "عيد الغطاس المجيد",
    "1-21": "عيد عرس قانا الجليل", "2-15": "عيد دخول المسيح الهيكل", "6-1": "عيد دخول المسيح أرض مصر",
    "7-12": "عيد الرسل (استشهاد بطرس وبولس)", "8-19": "عيد التجلي", "8-22": "عيد صعود جسد السيدة العذراء",
    "9-27": "عيد الصليب المجيد",
  };
  if (g[`${m}-${d}`]) return g[`${m}-${d}`];
  if (coptic.month === 1 && coptic.day === 1) return "عيد النيروز — رأس السنة القبطية";
  if (coptic.month === 7 && coptic.day === 29) return "عيد البشارة المجيد";
  if (coptic.day === 29) return "التذكار الشهري للبشارة والميلاد والقيامة";
  if (coptic.day === 21) return "التذكار الشهري للسيدة العذراء";
  return null;
}

export type LiturgicalDay = {
  date: Date;
  coptic: ReturnType<typeof toCoptic>;
  occasion: string | null;
  fast: Fast | null;
  isWedFriFast: boolean;
  theme: LiturgicalTheme;
};

export function getLiturgicalDay(date: Date = cairoToday()): LiturgicalDay {
  const coptic = toCoptic(date);
  const easter = copticEaster(date.getUTCFullYear());
  const rel = diffDays(date, easter);
  const moveable: Record<number, string> = {
    [-69]: "صوم يونان", [-66]: "فصح يونان", [-7]: "أحد الشعانين", [-3]: "خميس العهد",
    [-2]: "الجمعة العظيمة", [-1]: "سبت النور", 0: "عيد القيامة المجيد", 7: "أحد توما",
    39: "عيد الصعود المجيد", 49: "عيد العنصرة (حلول الروح القدس)",
  };
  const fast = currentFast(date);
  const inKhamasin = rel >= 0 && rel <= 49;
  const m = date.getUTCMonth() + 1, d = date.getUTCDate();
  const nativityOrEpiphany = (m === 1 && (d === 7 || d === 19));
  const dow = date.getUTCDay();
  const isWedFriFast = !fast && !inKhamasin && !nativityOrEpiphany && (dow === 3 || dow === 5);

  const occasion = moveable[rel] ?? fixedFeast(date, coptic);

  let theme: LiturgicalTheme = "annual";
  if (rel >= -6 && rel <= -1) theme = "passion";
  else if (inKhamasin || rel === -7 || (occasion && /عيد/.test(occasion))) theme = "festive";
  else if (coptic.month === 4) theme = "kiahk";
  else if (fast) theme = "fast";

  return { date, coptic, occasion, fast, isWedFriFast, theme };
}

/** Short deacon-friendly info for each fast/feast. */
const EVENT_INFO: Record<string, string> = {
  "صوم يونان (نينوى)": "صوم ثلاثة أيام على مثال توبة أهل نينوى — بداية روحية للصوم الكبير، تدريب على التوبة والرحمة.",
  "الصوم الكبير المقدس": "٥٥ يومًا: أسبوع الاستعداد ثم ٤٠ يومًا على مثال صوم السيد المسيح ثم أسبوع الآلام. وقت التوبة والميطانيات والصلوات الطقسية الصومية.",
  "صوم السيدة العذراء": "١٥ يومًا استعدادًا لعيد صعود جسد العذراء — تُقال فيه مدائح وكيهكية للعذراء يوميًا.",
  "صوم الميلاد المجيد": "٤٣ يومًا استعدادًا لميلاد المخلص — تُقال فيه سبعة وأربعة ومدائح كيهك في شهر كيهك.",
  "صوم الرسل الأطهار": "صوم على مثال الرسل قبل كرازتهم — يختلف طوله كل عام حسب موعد القيامة، وينتهي بعيد الرسل بطرس وبولس.",
  "عيد الميلاد المجيد": "ميلاد السيد المسيح بالجسد — ليلة الميلاد تُقال فيها التسبحة وألحان الفرح.",
  "عيد الغطاس المجيد": "معمودية السيد المسيح في الأردن — من الأعياد السيدية الكبرى، وفيه الظهور الإلهي.",
  "عيد القيامة المجيد": "أعظم الأعياد — قيامة المسيح من بين الأموات. تبدأ الخماسين المقدسة بطقس الفرح.",
  "عيد الصعود المجيد": "صعود الرب إلى السموات بعد أربعين يومًا من القيامة.",
  "عيد العنصرة (حلول الروح القدس)": "حلول الروح القدس على التلاميذ — عيد تأسيس الكنيسة وبداية الكرازة.",
  "عيد النيروز — رأس السنة القبطية": "بداية سنة الشهداء — تذكار شهداء الكنيسة وطقس فرايحي.",
  "عيد الصليب المجيد": "تذكار ظهور الصليب المقدس على يد الملكة هيلانة.",
};

export type UpcomingEvent = { name: string; daysLeft: number; kind: "fast" | "feast"; info: string | null };

/** Nearest upcoming fast or major feast within the next 90 days. */
export function getUpcomingEvent(date: Date = cairoToday()): UpcomingEvent | null {
  const candidates: { name: string; start: Date; kind: "fast" | "feast" }[] = [];
  for (const y of [date.getUTCFullYear(), date.getUTCFullYear() + 1]) {
    for (const r of fastRanges(y)) candidates.push({ name: r.name, start: r.start, kind: "fast" });
    const easter = copticEaster(y);
    candidates.push(
      { name: "عيد الميلاد المجيد", start: utc(y, 1, 7), kind: "feast" },
      { name: "عيد الغطاس المجيد", start: utc(y, 1, 19), kind: "feast" },
      { name: "عيد القيامة المجيد", start: easter, kind: "feast" },
      { name: "عيد الصعود المجيد", start: addDays(easter, 39), kind: "feast" },
      { name: "عيد العنصرة (حلول الروح القدس)", start: addDays(easter, 49), kind: "feast" },
      { name: "عيد النيروز — رأس السنة القبطية", start: utc(y, 9, 11), kind: "feast" },
      { name: "عيد الصليب المجيد", start: utc(y, 9, 27), kind: "feast" },
    );
  }
  let best: UpcomingEvent | null = null;
  for (const c of candidates) {
    const daysLeft = diffDays(c.start, date);
    if (daysLeft <= 0 || daysLeft > 90) continue;
    if (!best || daysLeft < best.daysLeft)
      best = { name: c.name, daysLeft, kind: c.kind, info: EVENT_INFO[c.name] ?? null };
  }
  return best;
}

/** Well-known hymns chanted in each occasion — what deacons need. */
export const EVENT_HYMNS: Record<string, string[]> = {
  "صوم يونان (نينوى)": ["ألحان صوم يونان الطقسية", "مرد الإنجيل (آفاف إنطي)", "لحن أومونوجينيس"],
  "الصوم الكبير المقدس": ["كيهكية الصوم الكبير", "الذكصولوجيات الصومية", "لحن أبيك", "مرد المزمور والإنجيل الصومي", "توبة أهل نينوى"],
  "صوم السيدة العذراء": ["مدائح العذراء (كيهكية العذراء)", "ثيؤطوكيات الأيام", "لحن طاي شوري", "مرد إنجيل العذراء"],
  "صوم الميلاد المجيد": ["سبعة وأربعة", "مدائح كيهك (السبت والأحد)", "لحن واطس الميلاد: إبؤرو", "تين أوأو إنسوك"],
  "صوم الرسل الأطهار": ["الذكصولوجيات السنوية", "مدائح الرسل والآباء"],
  "عيد الميلاد المجيد": ["إبؤرو (لحن واطس الميلاد)", "تين أوأو إنسوك", "بيك إثرونوس", "مرد إنجيل الميلاد"],
  "عيد الغطاس المجيد": ["لحن واطس الغطاس", "أومونوجينيس (آدام)", "مرد إنجيل الغطاس", "لحن الذكصولوجية الخاص بالعيد"],
  "عيد القيامة المجيد": ["خرستوس أنيستي (المسيح قام)", "لحن الفرح (الخمسين)", "مرد إنجيل القيامة", "إبؤرو الفرايحي"],
  "عيد الصعود المجيد": ["مرد إنجيل الصعود", "لحن الخمسين الفرايحي", "مدائح الصعود"],
  "عيد العنصرة (حلول الروح القدس)": ["مرد إنجيل العنصرة", "لحن بي إبنفما", "مدائح حلول الروح القدس"],
  "عيد النيروز — رأس السنة القبطية": ["لحن شيري ني ماريا", "مدائح الشهداء", "مرد إنجيل النيروز"],
  "عيد الصليب المجيد": ["لحن الصليب (إثو تي طاشڤي)", "مرد إنجيل عيد الصليب", "مدائح الصليب"],
};

/** Details block for the occasion/fast page: description + hymns. */
export function getOccasionDetails(day: LiturgicalDay): { name: string; info: string | null; hymns: string[] } | null {
  const name = day.occasion ?? day.fast?.name ?? null;
  if (!name) return null;
  return { name, info: EVENT_INFO[name] ?? null, hymns: EVENT_HYMNS[name] ?? [] };
}
