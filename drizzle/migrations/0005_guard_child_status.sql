CREATE OR REPLACE FUNCTION public.protect_child_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'servant'))
     AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.rejection_reason := NULL;
    ELSE
      NEW.status := OLD.status;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_child_status ON public.profiles;
CREATE TRIGGER protect_child_status BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_child_status();