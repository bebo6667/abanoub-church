ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS poll jsonb;

CREATE TABLE IF NOT EXISTS public.announcement_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_votes TO authenticated;
GRANT ALL ON public.announcement_votes TO service_role;

ALTER TABLE public.announcement_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select_all" ON public.announcement_votes
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "votes_insert_own" ON public.announcement_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes_update_own" ON public.announcement_votes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes_delete_own" ON public.announcement_votes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_announcement_votes_updated_at
  BEFORE UPDATE ON public.announcement_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();