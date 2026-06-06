
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin','deacon','servant');
CREATE TYPE public.requested_role AS ENUM ('admin','deacon','servant','pending');
CREATE TYPE public.profile_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.schedule_status AS ENUM ('draft','published');
CREATE TYPE public.attendance_status AS ENUM ('attend','decline');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  age INT,
  whatsapp TEXT,
  phone TEXT,
  address TEXT,
  church_name TEXT,
  spiritual_father TEXT,
  profile_image_url TEXT,
  requested_role public.requested_role NOT NULL DEFAULT 'pending',
  status public.profile_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

-- Schedules
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friday_date DATE NOT NULL,
  title TEXT,
  status public.schedule_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Assignments
CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_assignments TO authenticated;
GRANT ALL ON public.schedule_assignments TO service_role;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_responses TO authenticated;
GRANT ALL ON public.attendance_responses TO service_role;
ALTER TABLE public.attendance_responses ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin BOOLEAN := NEW.email = 'noopsboba@gmail.com';
  req_role public.requested_role;
BEGIN
  BEGIN
    req_role := COALESCE((NEW.raw_user_meta_data->>'requested_role')::public.requested_role, 'deacon');
  EXCEPTION WHEN OTHERS THEN req_role := 'deacon'; END;

  INSERT INTO public.profiles (id, email, full_name, age, whatsapp, phone, address, church_name, spiritual_father, requested_role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'age','')::INT,
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'church_name',
    NEW.raw_user_meta_data->>'spiritual_father',
    CASE WHEN is_admin THEN 'admin'::public.requested_role ELSE req_role END,
    CASE WHEN is_admin THEN 'approved'::public.profile_status ELSE 'pending'::public.profile_status END
  );
  IF is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users
INSERT INTO public.profiles (id, email, full_name, status, requested_role)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       CASE WHEN u.email='noopsboba@gmail.com' THEN 'approved'::public.profile_status ELSE 'pending'::public.profile_status END,
       CASE WHEN u.email='noopsboba@gmail.com' THEN 'admin'::public.requested_role ELSE 'deacon'::public.requested_role END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email='noopsboba@gmail.com'
ON CONFLICT DO NOTHING;

-- ===== RLS Policies =====
-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- schedules
CREATE POLICY "schedules_view_published" ON public.schedules FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "schedules_admin_all" ON public.schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- assignments
CREATE POLICY "assignments_view_own_or_admin" ON public.schedule_assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.status='published')
  );
CREATE POLICY "assignments_admin_all" ON public.schedule_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- attendance
CREATE POLICY "attendance_own_select" ON public.attendance_responses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "attendance_own_insert" ON public.attendance_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_own_update" ON public.attendance_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_admin_all" ON public.attendance_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
