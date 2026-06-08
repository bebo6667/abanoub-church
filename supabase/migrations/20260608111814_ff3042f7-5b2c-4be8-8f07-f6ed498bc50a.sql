
DO $$ BEGIN
  CREATE TYPE public.deacon_rank AS ENUM ('psaltos','agnostos','ibodiakon','diakon','archdiakon');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.education_stage AS ENUM ('primary','preparatory','secondary','university','graduate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rank public.deacon_rank,
  ADD COLUMN IF NOT EXISTS education_stage public.education_stage,
  ADD COLUMN IF NOT EXISTS last_confession_date date,
  ADD COLUMN IF NOT EXISTS home_latitude double precision,
  ADD COLUMN IF NOT EXISTS home_longitude double precision;

-- Allow approved users to view each other's directory data (so deacons/servants page works)
DROP POLICY IF EXISTS "Approved members can view directory" ON public.profiles;
CREATE POLICY "Approved members can view directory"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.status = 'approved'
    )
  );

-- Allow approved members to view roles too (for grouping by role)
DROP POLICY IF EXISTS "Approved members can view roles" ON public.user_roles;
CREATE POLICY "Approved members can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved'
    )
  );
