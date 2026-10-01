ALTER TYPE public.education_stage ADD VALUE IF NOT EXISTS 'nursery' BEFORE 'primary';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_grade smallint CHECK (school_grade BETWEEN 1 AND 6);