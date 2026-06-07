import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, profile, isAdmin, diagnostics, profileMissing, refresh, signOut } = useAuth();
  const navigate = useNavigate();

  const hasIssue = !loading && session && (diagnostics.length > 0 || profileMissing);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (hasIssue) return; // stop on diagnostic screen
    if (isAdmin) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    if (!profile) return;
    if (profile.status !== "approved") {
      navigate({ to: "/pending", replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [loading, session, profile, isAdmin, navigate, hasIssue]);

  if (hasIssue) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-bold">تعذّر تحميل بيانات الحساب</h2>
          </div>

          {profileMissing && diagnostics.length === 0 && (
            <div className="text-sm space-y-1">
              <p>تم تسجيل الدخول بنجاح، لكن لا يوجد ملف شخصي مرتبط بهذا الحساب في قاعدة البيانات.</p>
              <p className="text-muted-foreground">
                السبب الأرجح: مستخدم قديم تم إنشاؤه قبل إعداد جدول <code>profiles</code> أو قبل تفعيل
                المُحفّز <code>handle_new_user</code>. الحل: أعد التسجيل أو اطلب من المسؤول إدراج صف يدوياً.
              </p>
            </div>
          )}

          {diagnostics.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm">حدثت أخطاء أثناء قراءة الجداول التالية:</p>
              {diagnostics.map((d, i) => (
                <div key={i} className="rounded border bg-muted/40 p-3 text-xs space-y-1" dir="ltr">
                  <div className="font-bold">{d.source}</div>
                  {d.code && <div><span className="text-muted-foreground">code:</span> {d.code}</div>}
                  <div><span className="text-muted-foreground">message:</span> {d.message}</div>
                  {d.hint && <div><span className="text-muted-foreground">hint:</span> {d.hint}</div>}
                  {d.details && <div><span className="text-muted-foreground">details:</span> {d.details}</div>}
                  <div className="text-muted-foreground pt-1">
                    {d.code === "42P01" && "الجدول غير موجود — يجب إنشاؤه عبر الترحيل (migration)."}
                    {d.code === "42501" && "صلاحيات GRANT ناقصة على الجدول للدور authenticated."}
                    {(d.code === "PGRST301" || d.message?.toLowerCase().includes("rls")) &&
                      "سياسة RLS تمنع القراءة — تحقّق من السياسات."}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => refresh()} className="flex-1">
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
            >
              <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
