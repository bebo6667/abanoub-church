import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { loading, session, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    // Admin has servant privileges too — allow dashboard access without redirect.
    else if (!isAdmin && profile && profile.status !== "approved") navigate({ to: "/pending", replace: true });
  }, [loading, session, profile, isAdmin, navigate]);

  if (loading || !profile || (!isAdmin && profile.status !== "approved")) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  return <Outlet />;
}
