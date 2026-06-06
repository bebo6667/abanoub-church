import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
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
  }, [loading, session, profile, isAdmin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
