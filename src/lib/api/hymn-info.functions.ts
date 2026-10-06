import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Generates an AI explanation + info draft for a Coptic hymn (staff use). */
export const generateHymnInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<{ explanation: string; info: string }> => {
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
        "أنت خبير في الألحان القبطية الأرثوذكسية وفق المراجع الكنسية المعتمدة (كتاب الخولاجي، تسجيلات المعلم إبراهيم عياد، موقع الأنبا تكلا، tasbeha.org). أعد JSON فقط بدون أي نص آخر بالشكل: {\"explanation\":\"...\",\"info\":\"...\"}. " +
        "explanation: تفسير معنى كلمات اللحن بالعربية الواضحة في فقرة أو فقرتين، مع المعنى الروحي. " +
        "info: معلومات عملية للشمامسة: متى يُقال اللحن في السنة الطقسية، النغمة (آدم/واطس/سنوي...)، طريقة الأداء والمردات المرتبطة به، في فقرة أو فقرتين. " +
        "التزم بالمعتمد كنسيًا ولا تخترع معلومات؛ إن لم تكن متأكدًا من تفصيلة فاذكر أنها تحتاج مراجعة خادم الألحان.",
      prompt: `اللحن القبطي: «${data.name}» — اكتب تفسيره ومعلوماته للشمامسة.`,
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    try {
      const text = (await result.text).trim();
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      return {
        explanation: String(json.explanation ?? "").slice(0, 4000),
        info: String(json.info ?? "").slice(0, 4000),
      };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      if (status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي في مساحة العمل");
      if (status === 429) throw new Error("طلبات كثيرة، انتظر قليلًا ثم حاول");
      throw new Error("تعذر توليد الشرح الآن، حاول مرة أخرى");
    }
  });
