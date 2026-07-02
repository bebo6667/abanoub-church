
DROP POLICY IF EXISTS attendance_admin_all ON public.attendance_responses;
CREATE POLICY attendance_staff_all ON public.attendance_responses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));
