import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, session, isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (!isAdmin) {
      if (profile?.status === "approved") navigate({ to: "/dashboard", replace: true });
      else navigate({ to: "/pending", replace: true });
    }
  }, [loading, session, isAdmin, profile, navigate]);
  if (loading || !isAdmin) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  return <Outlet />;
}
