CREATE TABLE public.announcement_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_views TO authenticated;
GRANT ALL ON public.announcement_views TO service_role;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views_insert_own" ON public.announcement_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "views_select_own_or_staff" ON public.announcement_views FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'servant'::app_role));

CREATE TABLE public.announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reactions TO authenticated;
GRANT ALL ON public.announcement_reactions TO service_role;
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_all" ON public.announcement_reactions FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "reactions_insert_own" ON public.announcement_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_update_own" ON public.announcement_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete_own" ON public.announcement_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_reactions_updated BEFORE UPDATE ON public.announcement_reactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.announcement_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_views;