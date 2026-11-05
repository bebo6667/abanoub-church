import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COPTIC_MONTHS, fromCoptic } from "@/lib/coptic-calendar";

export type Saint = { name: string; summary: string };

const SYNAXARIUM_SOURCE = "https://st-takla.org/zJ/index.php/ar-synaxarium";

/**
 * Fetches the authentic Synaxarium text for a Coptic day from St-Takla.org
 * (the reference Coptic source) and caches it per Coptic day. No AI involved.
 */
export const getSynaxarium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month: z.number().int().min(1).max(13), day: z.number().int().min(1).max(30) }))
  .handler(async ({ data, context }): Promise<{ saints: Saint[] }> => {
    const { data: cached } = await (context.supabase as any)
      .from("synaxarium_cache").select("saints")
      .eq("coptic_month", data.month).eq("coptic_day", data.day).maybeSingle();
    const cachedSaints = (cached?.saints ?? []) as Saint[];
    if (cachedSaints.length >= 1) return { saints: cachedSaints };

    // Coptic dates map to a stable Gregorian date; any reference year works.
    const g = fromCoptic(1743, data.month, data.day);
    const iday = String(g.getUTCDate()).padStart(2, "0");
    const imonth = String(g.getUTCMonth() + 1).padStart(2, "0");
    const iyear = g.getUTCFullYear();
    const url = `${SYNAXARIUM_SOURCE}?view=synaxarium-arabic&dbl=ar&iday=${iday}&imonth=${imonth}&iyear=${iyear}`;

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "Accept-Language": "ar,en;q=0.8",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(String(res.status));
      html = await res.text();
    } catch (e: any) {
      if (e?.name === "TimeoutError") throw new Error("المصدر الكنسي لم يستجب، جرّب بعد قليل");
      throw new Error("تعذر الوصول إلى مصدر السنكسار الآن");
    }

    const saints = parseSynaxariumHtml(html);
    if (!saints.length) throw new Error("تعذر تحليل نص السنكسار من المصدر");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("synaxarium_cache")
      .upsert({ coptic_month: data.month, coptic_day: data.day, saints });
    return { saints };
  });

/** Extracts every commemoration section (title + full story) from the St-Takla day page. */
export function parseSynaxariumHtml(html: string): Saint[] {
  const preambleIdx = html.indexOf("من الشهر المبارك");
  if (preambleIdx === -1) return [];
  const start = html.lastIndexOf("<p", preambleIdx);
  const endSearch = html.indexOf("البحث في السنكسار", preambleIdx);
  const endNav = html.indexOf("الذهاب إلى", preambleIdx);
  const end = Math.min(...[endSearch, endNav].filter((n) => n > preambleIdx));
  if (end === -1 || !end) return [];
  let content = html.slice(start < 0 ? 0 : start, end);

  // Section boundaries are the divider images.
  content = content.replace(/<p[^>]*>\s*<img[^>]*divider\.png[^>]*>\s*<\/p>/gi, "\n@@S@@\n");
  content = content.replace(/<img[^>]*divider\.png[^>]*>/gi, "\n@@S@@\n");
  // Line breaks and paragraph ends become newlines; all other tags disappear.
  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|td|tr|table|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeEntities(content)
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const line of decoded) {
    if (line === "@@S@@") { chunks.push(cur); cur = []; continue; }
    cur.push(line);
  }
  chunks.push(cur);

  const saints: Saint[] = [];
  for (const [i, chunk] of chunks.entries()) {
    // The first chunk is the day preamble ("اليوم ... من الشهر المبارك") — not a commemoration.
    if (i === 0) continue;
    const lines = chunk.filter((l) => l !== "آمين." || chunk.length > 2);
    if (lines.length < 2) continue;
    const title = lines[0].replace(/^\W+/, "").trim();
    if (!title || title.length > 150) continue;
    if (/أختر اليوم|أعلى الصفحة|اختر اليوم/.test(title)) continue;
    // Drop the date line right after the title, e.g. "1 توت - 11 سبتمبر".
    const body = lines.slice(1).filter((l) => !/^\d{1,2}\s+[\u0621-\u064A]+\s*-\s*\d{1,2}\s+[\u0621-\u064A]+$/.test(l));
    const summary = body.join("\n");
    if (summary.length < 40) continue;
    saints.push({ name: title, summary: summary.slice(0, 8000) });
  }
  return saints;
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&#39;": "'",
    "&lt;": "<", "&gt;": ">", "&laquo;": "«", "&raquo;": "»", "&mdash;": "—", "&ndash;": "–",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(nbsp|amp|quot|apos|lt|gt|laquo|raquo|mdash|ndash);/g, (m) => named[m] ?? m);
}

export { COPTIC_MONTHS };
