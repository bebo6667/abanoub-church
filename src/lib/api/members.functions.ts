import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fully removes a member (auth account + profile). Admin only. */
export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("لا يمكنك حذف حسابك الشخصي");
    }

    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("هذا الإجراء متاح للأدمن فقط");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      // Fall back to removing the profile row when there is no auth user.
      const { error: pErr } = await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
      if (pErr) throw new Error(error.message);
    }
    return { ok: true };
  });
