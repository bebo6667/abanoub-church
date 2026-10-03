import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COPTIC_MONTHS } from "@/lib/coptic-calendar";

export type Saint = { name: string; summary: string };

/** Returns today's synaxarium saints with short AI summaries, cached per Coptic day. */
export const getSynaxarium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month: z.number().int().min(1).max(13), day: z.number().int().min(1).max(30) }))
  .handler(async ({ data, context }): Promise<{ saints: Saint[] }> => {
    const { data: cached } = await (context.supabase as any)
      .from("synaxarium_cache").select("saints")
      .eq("coptic_month", data.month).eq("coptic_day", data.day).maybeSingle();
    if (cached?.saints?.length) return { saints: cached.saints as Saint[] };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      maxRetries: 0,
      system:
        "أنت خبير في السنكسار القبطي الأرثوذكسي المعتمد من الكنيسة القبطية. أعد JSON فقط بدون أي نص آخر بالشكل: {\"saints\":[{\"name\":\"...\",\"summary\":\"...\"}]}. اذكر تذكارات هذا اليوم القبطي كما وردت في السنكسار (من 1 إلى 5 تذكارات). الملخص بالعربية في سطرين إلى ثلاثة: من هو، وأبرز ما في سيرته، ودرس روحي قصير للشمامسة. لا تخترع قديسين؛ إن لم تكن متأكدًا قلل العدد.",
      prompt: `اليوم القبطي: ${data.day} ${COPTIC_MONTHS[data.month - 1]}`,
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    let saints: Saint[] = [];
    try {
      const text = (await result.text).trim();
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      saints = (json.saints ?? [])
        .filter((s: any) => s?.name && s?.summary)
        .map((s: any) => ({ name: String(s.name).slice(0, 200), summary: String(s.summary).slice(0, 600) }));
    } catch (e: any) {
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      if (status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي في مساحة العمل");
      if (status === 429) throw new Error("طلبات كثيرة، انتظر قليلًا ثم حاول");
      throw new Error("تعذر تحميل السنكسار الآن");
    }
    if (saints.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("synaxarium_cache")
        .upsert({ coptic_month: data.month, coptic_day: data.day, saints });
    }
    return { saints };
  });
