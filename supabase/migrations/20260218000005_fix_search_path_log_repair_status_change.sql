CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    INSERT INTO repair_status_history (repair_id, status, changed_by, note)
    VALUES (
      NEW.id,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Reparación creada'
        ELSE 'Estado actualizado'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;
