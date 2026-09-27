BEGIN;

ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_movements_session_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.cash_movements
      ADD CONSTRAINT cash_movements_session_id_fkey FOREIGN KEY (session_id)
      REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' AND column_name = 'session_id'
  ) THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON public.cash_movements (session_id);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_payment_method_chk'
  ) THEN
    ALTER TABLE public.cash_movements
      ADD CONSTRAINT cash_movements_payment_method_chk 
      CHECK (payment_method IN ('cash','card','transfer','mixed'));
  END IF;
END$$;

COMMIT;
