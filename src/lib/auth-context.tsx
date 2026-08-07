import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { computeAge } from "@/lib/age";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  age: number | null;
  date_of_birth: string | null;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  church_name: string | null;
  spiritual_father: string | null;
  profile_image_url: string | null;
  requested_role: "admin" | "deacon" | "servant" | "pending";
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  rank: "psaltos" | "agnostos" | "ibodiakon" | "diakon" | "archdiakon" | null;
  education_stage: "primary" | "preparatory" | "secondary" | "university" | "graduate" | null;
  last_confession_date: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  linked_servant_id: string | null;
};

export type AuthDiagnostic = {
  source: "profiles" | "user_roles";
  code?: string;
  message: string;
  hint?: string;
  details?: string;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  isAdmin: boolean;
  isServant: boolean;
  isStaff: boolean;
  loading: boolean;
  diagnostics: AuthDiagnostic[];
  profileMissing: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostic[]>([]);
  const [profileMissing, setProfileMissing] = useState(false);

  async function loadUserData(uid: string) {
    const diags: AuthDiagnostic[] = [];
    const [pRes, rRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", uid).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", uid),
    ]);

    if (pRes.error) {
      diags.push({
        source: "profiles",
        code: pRes.error.code,
        message: pRes.error.message,
        hint: pRes.error.hint,
        details: pRes.error.details,
      });
      setProfile(null);
      setProfileMissing(false);
    } else {
      const p = (pRes.data as Profile | null) ?? null;
      // العمر يتحدث تلقائيًا من تاريخ الميلاد كل يوم
      if (p?.date_of_birth) {
        const computed = computeAge(p.date_of_birth);
        if (computed !== null && computed !== p.age) {
          p.age = computed;
          db.from("profiles").update({ age: computed }).eq("id", uid).then(() => {});
        }
      }
      setProfile(p);
      setProfileMissing(!p);
    }

    if (rRes.error) {
      diags.push({
        source: "user_roles",
        code: rRes.error.code,
        message: rRes.error.message,
        hint: rRes.error.hint,
        details: rRes.error.details,
      });
      setRoles([]);
    } else {
      setRoles(((rRes.data as { role: string }[]) ?? []).map((x) => x.role));
    }

    setDiagnostics(diags);
    if (diags.length || !pRes.data) {
      // eslint-disable-next-line no-console
      console.warn("[auth] diagnostics", { diags, profile: pRes.data, roles: rRes.data });
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setDiagnostics([]);
        setProfileMissing(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    isServant: roles.includes("servant"),
    isStaff: roles.includes("admin") || roles.includes("servant"),
    loading,
    diagnostics,
    profileMissing,
    refresh: async () => {
      if (session?.user) await loadUserData(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
