REVOKE ALL ON FUNCTION public.friday_attendance_reminder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friday_attendance_reminder() TO postgres;