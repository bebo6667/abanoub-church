-- حسابات أولياء الأمور: قيم جديدة للأنواع
ALTER TYPE public.requested_role ADD VALUE IF NOT EXISTS 'guardian' AFTER 'pending';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guardian' AFTER 'servant';

-- ربط الطفل بولي الأمر
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ملفات الأبناء بلا حساب دخول: تخفيف القيد الصارم مع الحفاظ على الحذف المتسلسل عبر مُحفّز
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

-- توجيه إشعارات الأبناء إلى حساب ولي الأمر
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s_status schedule_status;
  s_date DATE;
  child_name TEXT;
  routed_to UUID;
BEGIN
  SELECT s.status, s.friday_date, p.full_name, COALESCE(p.parent_id, NEW.user_id)
    INTO s_status, s_date, child_name, routed_to
  FROM public.schedules s
  JOIN public.profiles p ON p.id = NEW.user_id
  WHERE s.id = NEW.schedule_id;

  IF s_status = 'published' AND routed_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    VALUES (
      routed_to,
      'schedule_updated',
      CASE WHEN routed_to IS DISTINCT FROM NEW.user_id
        THEN 'خدمة جديدة مسندة لـ ' || COALESCE(child_name, 'شماس')
        ELSE 'خدمة جديدة مسندة إليك' END,
      'تم إسناد خدمة جديدة في جدول ' || to_char(s_date, 'YYYY-MM-DD'),
      '/dashboard/schedule/' || NEW.schedule_id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_schedule_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published')
     OR (TG_OP = 'INSERT' AND NEW.status = 'published') THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    SELECT DISTINCT COALESCE(p.parent_id, sa.user_id),
      'schedule_published',
      'تم نشر جدول جديد',
      'جدول قداس الجمعة ' || to_char(NEW.friday_date, 'YYYY-MM-DD') || ' — لديك خدمة، فضلاً أكّد الحضور أو الاعتذار.',
      '/dashboard/schedule/' || NEW.id::text
    FROM public.schedule_assignments sa
    JOIN public.profiles p ON p.id = sa.user_id
    WHERE sa.schedule_id = NEW.id;
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'published' AND (OLD.friday_date IS DISTINCT FROM NEW.friday_date OR OLD.title IS DISTINCT FROM NEW.title OR OLD.notes IS DISTINCT FROM NEW.notes)) THEN
    INSERT INTO public.notifications (user_id, type, title, body, url)
    SELECT DISTINCT COALESCE(p.parent_id, sa.user_id),
      'schedule_updated',
      'تم تحديث الجدول',
      'تم تحديث جدول قداس الجمعة ' || to_char(NEW.friday_date, 'YYYY-MM-DD'),
      '/dashboard/schedule/' || NEW.id::text
    FROM public.schedule_assignments sa
    JOIN public.profiles p ON p.id = sa.user_id
    WHERE sa.schedule_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deacon_self_attendance_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE cairo_now timestamp := (now() AT TIME ZONE 'Africa/Cairo');
BEGIN
  IF to_char(cairo_now,'HH24') <> '10' OR extract(dow from cairo_now) <> 5 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE type='self_attendance_reminder'
     AND (created_at AT TIME ZONE 'Africa/Cairo')::date = cairo_now::date) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, url)
  SELECT DISTINCT COALESCE(p.parent_id, p.id), 'self_attendance_reminder', 'سجّل حضورك في قداس اليوم',
    'انتهى القداس — من فضلك سجّل حضورك أو غيابك الآن ليؤكده الخادم.', '/dashboard/checkin'
  FROM public.profiles p
  WHERE p.status='approved'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p.id AND ur.role IN ('admin','servant'));
END;
$function$;