CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.friday_attendance_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cairo_now timestamp := (now() AT TIME ZONE 'Africa/Cairo');
BEGIN
  -- run only at 22:00 Cairo time on Friday (guards DST shift)
  IF to_char(cairo_now, 'HH24') <> '22' OR extract(dow from cairo_now) <> 5 THEN
    RETURN;
  END IF;

  -- avoid duplicates within the same day
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'attendance_reminder'
      AND (created_at AT TIME ZONE 'Africa/Cairo')::date = cairo_now::date
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, url)
  SELECT DISTINCT ur.user_id,
    'attendance_reminder',
    'تذكير: تسجيل الحضور والغياب',
    'لا تنسَ تسجيل حضور وغياب الشمامسة لقداس اليوم، ومتابعة الافتقاد للمتغيبين.',
    '/dashboard/checkin'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','servant');
END;
$$;

SELECT cron.schedule('friday-attendance-reminder-19', '0 19 * * 5', $$SELECT public.friday_attendance_reminder();$$);
SELECT cron.schedule('friday-attendance-reminder-20', '0 20 * * 5', $$SELECT public.friday_attendance_reminder();$$);