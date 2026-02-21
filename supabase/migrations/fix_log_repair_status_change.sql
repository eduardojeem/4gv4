
CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by, notes)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      'Estado actualizado'
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO repair_status_history (repair_id, new_status, changed_by, notes)
    VALUES (
      NEW.id,
      NEW.status,
      auth.uid(),
      'Reparación creada'
    );
  END IF;
  RETURN NEW;
END;
$$;
