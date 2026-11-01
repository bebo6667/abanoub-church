-- سياسات RLS لحسابات أولياء الأمور والأبناء

CREATE POLICY "Guardians can view their children"
ON public.profiles FOR SELECT TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Guardians can add children"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (parent_id = auth.uid() AND has_role(auth.uid(), 'guardian'));

CREATE POLICY "Guardians can update their children"
ON public.profiles FOR UPDATE TO authenticated
USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Guardians can remove their children"
ON public.profiles FOR DELETE TO authenticated
USING (parent_id = auth.uid());

-- تحويل الحساب إلى ولي أمر (دور آمن لا يمنح صلاحيات إدارية)
CREATE POLICY "Users can make themselves guardian"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'guardian');

-- الأبناء يظهرون كشمامسة في الجداول والإحصائيات
CREATE POLICY "Guardians can mark children as deacons"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (role = 'deacon' AND EXISTS (
  SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()
));

-- الرد على الخدمات نيابة عن الأبناء
CREATE POLICY "Guardians respond for their children"
ON public.attendance_responses FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()
));

CREATE POLICY "Guardians update children responses"
ON public.attendance_responses FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()));

CREATE POLICY "Guardians view children responses"
ON public.attendance_responses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()));

-- تسجيل الحضور الذاتي نيابة عن الأبناء
CREATE POLICY "Guardians self report for children"
ON public.attendance_checkins FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid())
  AND checked_by = auth.uid()
  AND self_reported = true
  AND confirmed_by IS NULL
);

CREATE POLICY "Guardians update children self reports"
ON public.attendance_checkins FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid())
  AND self_reported = true
  AND confirmed_by IS NULL
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid())
  AND self_reported = true
  AND confirmed_by IS NULL
);

CREATE POLICY "Guardians view children checkins"
ON public.attendance_checkins FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles c WHERE c.id = user_id AND c.parent_id = auth.uid()));