
CREATE TABLE public.attendance_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  present BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  checked_by UUID NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_checkins TO authenticated;
GRANT ALL ON public.attendance_checkins TO service_role;

ALTER TABLE public.attendance_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view checkins"
  ON public.attendance_checkins FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Staff can insert checkins"
  ON public.attendance_checkins FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'))
    AND checked_by = auth.uid()
  );

CREATE POLICY "Staff can update checkins"
  ON public.attendance_checkins FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));

CREATE POLICY "Staff can delete checkins"
  ON public.attendance_checkins FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));

CREATE TRIGGER attendance_checkins_updated_at
  BEFORE UPDATE ON public.attendance_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX attendance_checkins_schedule_idx ON public.attendance_checkins(schedule_id);
CREATE INDEX attendance_checkins_user_idx ON public.attendance_checkins(user_id);
