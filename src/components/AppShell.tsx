import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Church, LogOut, LayoutDashboard, Calendar, Users, User, UserCheck } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import type { ReactNode } from "react";


export function AppShell({ children, title, isAdmin: _isAdmin }: { children: ReactNode; title: string; isAdmin?: boolean }) {
  const { signOut, profile, isStaff } = useAuth();
  const navigate = useNavigate();

  const navItems = isStaff
    ? [
        { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
        { to: "/dashboard/schedule", label: "الجدول", icon: Calendar },
        { to: "/dashboard/checkin", label: "الحضور", icon: UserCheck },
        { to: "/admin", label: "إدارة", icon: Church },
        { to: "/dashboard/members", label: "الأعضاء", icon: Users },
        { to: "/dashboard/profile", label: "حسابي", icon: User },
      ]
    : [
        { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
        { to: "/dashboard/schedule", label: "الجدول", icon: Calendar },
        { to: "/dashboard/checkin", label: "حضوري", icon: UserCheck },
        { to: "/dashboard/members", label: "الأعضاء", icon: Users },
        { to: "/dashboard/profile", label: "حسابي", icon: User },
      ];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full gradient-sacred">
              <Church className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{title}</h1>
              {profile && <p className="text-xs text-muted-foreground leading-tight">{profile.full_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0,1fr))` }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground data-[status=active]:text-primary"
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span className={isActive ? "text-primary font-medium" : ""}>{label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
