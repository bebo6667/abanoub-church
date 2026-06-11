import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { subscribeAssignmentNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { loading, session, profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (!isAdmin && profile && profile.status !== "approved") navigate({ to: "/pending", replace: true });
  }, [loading, session, profile, isAdmin, navigate]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAssignmentNotifications(user.id);
    return () => unsub();
  }, [user?.id]);

  if (loading || !profile || (!isAdmin && profile.status !== "approved")) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  return <Outlet />;
}
