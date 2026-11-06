import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COPTIC_MONTHS, fromCoptic } from "@/lib/coptic-calendar";

export type Saint = { name: string; summary: string; source?: string };

const SYNAXARIUM_SOURCE = "https://st-takla.org/zJ/index.php/ar-synaxarium";

/** Fetches the original Arabic Synaxarium entries for a Coptic day and caches them. */
export const getSynaxarium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month: z.number().int().min(1).max(13), day: z.number().int().min(1).max(30) }))
  .handler(async ({ data, context }): Promise<{ saints: Saint[]; sourceUrl: string }> => {
    const g = fromCoptic(1743, data.month, data.day);
    const iday = String(g.getUTCDate()).padStart(2, "0");
    const imonth = String(g.getUTCMonth() + 1).padStart(2, "0");
    const iyear = g.getUTCFullYear();
    const sourceUrl = `${SYNAXARIUM_SOURCE}?view=synaxarium-arabic&dbl=ar&iday=${iday}&imonth=${imonth}&iyear=${iyear}`;

    const { data: cached } = await (context.supabase as any)
      .from("synaxarium_cache").select("saints")
      .eq("coptic_month", data.month).eq("coptic_day", data.day).maybeSingle();
    const cachedSaints = (cached?.saints ?? []) as Saint[];
    // Previous cache rows contain generated summaries; only reuse entries tagged as source text.
    if (cachedSaints.length > 0 && cachedSaints.every((saint) => saint.source === "St-Takla")) {
      return { saints: cachedSaints, sourceUrl };
    }

    let html: string;
    try {
      const res = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "Accept-Language": "ar,en;q=0.8",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(String(res.status));
      html = await res.text();
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw new Error("المصدر الكنسي لم يستجب، جرّب بعد قليل");
      throw new Error("تعذر الوصول إلى مصدر السنكسار الآن");
    }

    const saints = parseSynaxariumHtml(html);
    if (!saints.length) throw new Error("تعذر استخراج تذكارات هذا اليوم من المصدر الكنسي");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("synaxarium_cache")
      .upsert({ coptic_month: data.month, coptic_day: data.day, saints });
    return { saints, sourceUrl };
  });

/** Extracts all titled commemoration sections while preserving the source's Arabic text. */
export function parseSynaxariumHtml(html: string): Saint[] {
  const paragraphs = [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p\s*>/gi)].map((match) => ({
    attributes: match[1] ?? "",
    text: htmlToText(match[2] ?? ""),
  }));
  const preambleIndex = paragraphs.findIndex(({ text }) => text.includes("من الشهر المبارك"));
  if (preambleIndex < 0) return [];

  const entries: Saint[] = [];
  let title: string | null = null;
  let story: string[] = [];
  const save = () => {
    const summary = story.join("\n").trim();
    if (title && summary) entries.push({ name: title, summary, source: "St-Takla" });
  };

  for (const paragraph of paragraphs.slice(preambleIndex + 1)) {
    const line = paragraph.text.trim();
    if (!line || line.includes("أعلى الصفحة") || line.includes("الذهاب إلى :")) break;

    const attrs = paragraph.attributes.toLowerCase();
    const isCommemorationTitle = /text-align\s*:\s*center/.test(attrs)
      && /color\s*:\s*#8b0000/.test(attrs)
      && /font-size\s*:\s*24px/.test(attrs);
    if (isCommemorationTitle) {
      save();
      title = line;
      story = [];
      continue;
    }

    // Ignore the centered date heading before the first actual commemoration.
    if (!title && /اليوم السابع عشر|اليوم الثامن|اليوم التاسع|اليوم العاشر|اليوم الأول|اليوم الثاني|اليوم الثالث|اليوم الرابع|اليوم الخامس|اليوم السادس|شهر/.test(line)) continue;
    if (title) story.push(line);
  }
  save();
  return entries;
}

function htmlToText(markup: string): string {
  return decodeEntities(markup
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&#39;": "'",
    "&lt;": "<", "&gt;": ">", "&laquo;": "«", "&raquo;": "»", "&mdash;": "—", "&ndash;": "–",
  };
  return value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(parseInt(digits, 16)))
    .replace(/&(nbsp|amp|quot|apos|lt|gt|laquo|raquo|mdash|ndash);/gi, (entity) => named[entity.toLowerCase()] ?? entity);
}

export { COPTIC_MONTHS };