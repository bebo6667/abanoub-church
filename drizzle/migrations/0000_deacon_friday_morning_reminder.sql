CREATE OR REPLACE FUNCTION public.deacon_self_attendance_reminder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cairo_now timestamp := (now() AT TIME ZONE 'Africa/Cairo');
BEGIN
  IF to_char(cairo_now,'HH24') <> '10' OR extract(dow from cairo_now) <> 5 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE type='self_attendance_reminder'
     AND (created_at AT TIME ZONE 'Africa/Cairo')::date = cairo_now::date) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, url)
  SELECT p.id, 'self_attendance_reminder', 'سجّل حضورك في قداس اليوم',
    'انتهى القداس — من فضلك سجّل حضورك أو غيابك الآن ليؤكده الخادم.', '/dashboard/checkin'
  FROM public.profiles p
  WHERE p.status='approved'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p.id AND ur.role IN ('admin','servant'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.deacon_self_attendance_reminder() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.friday_attendance_reminder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cairo_now timestamp := (now() AT TIME ZONE 'Africa/Cairo');
BEGIN
  IF to_char(cairo_now,'HH24') <> '22' OR extract(dow from cairo_now) <> 5 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE type='attendance_reminder'
     AND (created_at AT TIME ZONE 'Africa/Cairo')::date = cairo_now::date) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, url)
  SELECT DISTINCT ur.user_id, 'attendance_reminder', 'تذكير: تأكيد حضور الشمامسة',
    'راجع وأكّد حضور وغياب الشمامسة لقداس اليوم، وتابع الافتقاد للمتغيبين.', '/dashboard/checkin'
  FROM public.user_roles ur WHERE ur.role IN ('admin','servant');
END; $$;