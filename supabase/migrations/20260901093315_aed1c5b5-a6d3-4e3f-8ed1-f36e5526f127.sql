ALTER TABLE public.attendance_checkins
  ADD COLUMN IF NOT EXISTS self_reported boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE POLICY "Members can self report attendance"
ON public.attendance_checkins FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND checked_by = auth.uid()
  AND self_reported = true
  AND confirmed_by IS NULL
  AND public.is_approved(auth.uid())
);

CREATE POLICY "Members can update own unconfirmed self report"
ON public.attendance_checkins FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND self_reported = true AND confirmed_by IS NULL)
WITH CHECK (user_id = auth.uid() AND self_reported = true AND confirmed_by IS NULL);

CREATE POLICY "Members can delete own unconfirmed self report"
ON public.attendance_checkins FOR DELETE TO authenticated
USING (user_id = auth.uid() AND self_reported = true AND confirmed_by IS NULL);