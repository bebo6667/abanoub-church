
-- 1) Helper: is the given user approved? SECURITY DEFINER bypasses RLS to avoid recursion.
CREATE OR REPLACE FUNCTION public.is_approved(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND status = 'approved'
  );
$$;

-- 2) Replace recursive policies
DROP POLICY IF EXISTS "Approved members can view directory" ON public.profiles;
CREATE POLICY "Approved members can view directory"
ON public.profiles FOR SELECT
TO authenticated
USING (status = 'approved' AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved members can view roles" ON public.user_roles;
CREATE POLICY "Approved members can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

-- 3) Linked servant for deacons
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_servant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_linked_servant_id_idx ON public.profiles(linked_servant_id);
