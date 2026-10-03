import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SERVICE_LABELS, SERVICE_ORDER, formatFridayDate, type ServiceType } from "@/lib/services";

/** Generates an Arabic WhatsApp message for a published Friday schedule. Staff only. */
export const generateScheduleWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ scheduleId: z.string().uuid(), details: z.string().max(2000).default("") }))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "servant")) {
      throw new Error("هذه الميزة متاحة للخدام والأدمن فقط");
    }
    const [{ data: schedule }, { data: assignments }] = await Promise.all([
      context.supabase.from("schedules").select("*").eq("id", data.scheduleId).maybeSingle(),
      context.supabase
        .from("schedule_assignments")
        .select("service_type, profiles!schedule_assignments_user_id_fkey(full_name)")
        .eq("schedule_id", data.scheduleId),
    ]);
    if (!schedule) throw new Error("الجدول غير موجود");

    const roster = SERVICE_ORDER.map((svc) => {
      const names = (assignments ?? [])
        .filter((a: any) => a.service_type === svc)
        .map((a: any) => a.profiles?.full_name)
        .filter(Boolean);
      return names.length ? `- ${SERVICE_LABELS[svc as ServiceType]}: ${names.join("، ")}` : null;
    }).filter(Boolean).join("\n");

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
        "أنت مساعد لخادم في كنيسة قبطية أرثوذكسية. اكتب رسالة واتساب عربية واضحة ومهذبة وقصيرة (أقل من 250 كلمة) موجهة للشمامسة عن جدول خدمة قداس الجمعة. ابدأ بتحية كنسية، اذكر التاريخ، ثم قائمة الخدمات وأسماء الشمامسة بنقاط مرتبة، ثم التفاصيل الإضافية، واطلب منهم تأكيد الحضور أو الاعتذار من التطبيق. استخدم رموز تعبيرية بسيطة مناسبة. أعد نص الرسالة فقط بدون أي شرح.",
      prompt: `تاريخ القداس: ${formatFridayDate(schedule.friday_date)}\n\nتوزيع الخدمات:\n${roster || "لم يتم التوزيع بعد"}\n\nتفاصيل إضافية من المسؤول:\n${data.details || "لا يوجد"}`,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    try {
      const text = (await result.text).trim();
      if (!text) throw new Error("لم يتم إنشاء رسالة، حاول مرة أخرى لاحقًا");
      return { text };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      if (status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي في مساحة العمل");
      if (status === 429) throw new Error("طلبات كثيرة، انتظر قليلًا ثم حاول");
      throw new Error(e?.message || "تعذر إنشاء الرسالة");
    }
  });
