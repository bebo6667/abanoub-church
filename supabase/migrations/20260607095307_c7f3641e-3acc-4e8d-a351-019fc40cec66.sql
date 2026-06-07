
-- Add explicit FKs so PostgREST embeds work
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.schedule_assignments
  DROP CONSTRAINT IF EXISTS schedule_assignments_schedule_id_fkey,
  ADD CONSTRAINT schedule_assignments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS schedule_assignments_user_id_fkey,
  ADD CONSTRAINT schedule_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.attendance_responses
  DROP CONSTRAINT IF EXISTS attendance_responses_assignment_id_fkey,
  ADD CONSTRAINT attendance_responses_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS attendance_responses_user_id_fkey,
  ADD CONSTRAINT attendance_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
