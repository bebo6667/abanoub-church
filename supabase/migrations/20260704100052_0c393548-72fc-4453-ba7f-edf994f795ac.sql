
CREATE TABLE public.visitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deacon_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitations TO authenticated;
GRANT ALL ON public.visitations TO service_role;

ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all visitations"
  ON public.visitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));

CREATE POLICY "Deacons view own visitations"
  ON public.visitations FOR SELECT TO authenticated
  USING (deacon_id = auth.uid());

CREATE POLICY "Staff insert visitations"
  ON public.visitations FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant')) AND by_user_id = auth.uid());

CREATE POLICY "Staff update visitations"
  ON public.visitations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));

CREATE POLICY "Staff delete visitations"
  ON public.visitations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'servant'));

CREATE TRIGGER update_visitations_updated_at
  BEFORE UPDATE ON public.visitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX visitations_deacon_idx ON public.visitations(deacon_id, visited_at DESC);
