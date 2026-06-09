
-- Allow both admins and servants to manage schedules
DROP POLICY IF EXISTS schedules_admin_all ON public.schedules;
DROP POLICY IF EXISTS schedules_view_published ON public.schedules;

CREATE POLICY schedules_staff_all ON public.schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));

CREATE POLICY schedules_view_published ON public.schedules
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));

DROP POLICY IF EXISTS assignments_admin_all ON public.schedule_assignments;
DROP POLICY IF EXISTS assignments_view_own_or_admin ON public.schedule_assignments;

CREATE POLICY assignments_staff_all ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'));

CREATE POLICY assignments_view_own_or_staff ON public.schedule_assignments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'servant')
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.status = 'published')
  );
