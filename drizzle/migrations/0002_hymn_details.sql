CREATE TABLE public.hymn_details (
  name text PRIMARY KEY,
  explanation text,
  info text,
  video_url text,
  video_path text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hymn_details TO authenticated;
GRANT ALL ON public.hymn_details TO service_role;
ALTER TABLE public.hymn_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read hymns" ON public.hymn_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert hymns" ON public.hymn_details FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));
CREATE POLICY "Staff update hymns" ON public.hymn_details FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));
CREATE POLICY "Staff delete hymns" ON public.hymn_details FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));
CREATE POLICY "Signed-in read hymn videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hymns');
CREATE POLICY "Staff upload hymn videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hymns' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));
CREATE POLICY "Staff update hymn videos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hymns' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));
CREATE POLICY "Staff delete hymn videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hymns' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));