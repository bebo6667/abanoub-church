
CREATE POLICY "announcements_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'announcements');

CREATE POLICY "announcements_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));

CREATE POLICY "announcements_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'announcements' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));

CREATE POLICY "announcements_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'announcements' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')));
