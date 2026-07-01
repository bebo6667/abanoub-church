
-- =========================================================
-- Announcements table
-- =========================================================
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{url, type, name, mime}]
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_view_all" ON public.announcements
  FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));

CREATE POLICY "announcements_staff_write" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));

CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- In-app notifications
-- =========================================================
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- schedule_published | schedule_updated | announcement | attendance_confirmed | attendance_excused
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own_select" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_own_delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Staff can insert notifications for anyone (used by client fallback); triggers below run as security definer.
CREATE POLICY "notifications_staff_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant') OR user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- =========================================================
-- Trigger: schedule published -> notify all assigned users
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_schedule_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published')
     OR (TG_OP = 'INSERT' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    SELECT DISTINCT sa.user_id,
      'schedule_published',
      'تم نشر جدول جديد',
      'جدول قداس الجمعة ' || to_char(NEW.friday_date, 'YYYY-MM-DD') || ' — لديك خدمة، فضلاً أكّد الحضور أو الاعتذار.',
      '/dashboard/schedule/' || NEW.id::text
    FROM public.schedule_assignments sa WHERE sa.schedule_id = NEW.id;
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'published' AND (OLD.friday_date IS DISTINCT FROM NEW.friday_date OR OLD.title IS DISTINCT FROM NEW.title OR OLD.notes IS DISTINCT FROM NEW.notes)) THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    SELECT DISTINCT sa.user_id,
      'schedule_updated',
      'تم تحديث الجدول',
      'تم تحديث جدول قداس الجمعة ' || to_char(NEW.friday_date, 'YYYY-MM-DD'),
      '/dashboard/schedule/' || NEW.id::text
    FROM public.schedule_assignments sa WHERE sa.schedule_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_schedule_published
  AFTER INSERT OR UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.notify_schedule_published();

-- =========================================================
-- Trigger: new assignment on published schedule -> notify user
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_status schedule_status;
  s_date DATE;
BEGIN
  SELECT status, friday_date INTO s_status, s_date FROM public.schedules WHERE id = NEW.schedule_id;
  IF s_status = 'published' THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    VALUES (NEW.user_id, 'schedule_updated', 'خدمة جديدة مسندة إليك',
      'تم إسناد خدمة جديدة في جدول ' || to_char(s_date, 'YYYY-MM-DD'),
      '/dashboard/schedule/' || NEW.schedule_id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_assignment
  AFTER INSERT ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_assignment();

-- =========================================================
-- Trigger: attendance response -> notify staff (admins)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_attendance_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deacon_name TEXT;
  svc TEXT;
  s_date DATE;
  s_id UUID;
  n_title TEXT;
  n_body TEXT;
BEGIN
  SELECT p.full_name, sa.service_type, s.friday_date, s.id
    INTO deacon_name, svc, s_date, s_id
  FROM public.schedule_assignments sa
  JOIN public.schedules s ON s.id = sa.schedule_id
  JOIN public.profiles p ON p.id = sa.user_id
  WHERE sa.id = NEW.assignment_id;

  IF NEW.status = 'attend' THEN
    n_title := 'تأكيد حضور خدمة';
    n_body := COALESCE(deacon_name,'شماس') || ' أكّد الحضور — جدول ' || to_char(s_date,'YYYY-MM-DD');
  ELSE
    n_title := 'اعتذار عن خدمة';
    n_body := COALESCE(deacon_name,'شماس') || ' اعتذر' || COALESCE(' — ' || NEW.reason, '') || ' — جدول ' || to_char(s_date,'YYYY-MM-DD');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, url)
  SELECT ur.user_id,
    CASE WHEN NEW.status = 'attend' THEN 'attendance_confirmed' ELSE 'attendance_excused' END,
    n_title, n_body, '/dashboard/schedule/' || s_id::text
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','servant');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_attendance_response
  AFTER INSERT OR UPDATE ON public.attendance_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_response();

-- =========================================================
-- Trigger: new announcement -> notify all approved users
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    SELECT p.id, 'announcement', 'إعلان جديد: ' || NEW.title,
      COALESCE(substring(NEW.body from 1 for 140), ''), '/dashboard'
    FROM public.profiles p WHERE p.status = 'approved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_announcement();
