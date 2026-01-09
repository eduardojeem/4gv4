BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  opened_by text,
  closed_by text,
  opening_balance numeric NOT NULL,
  closing_balance numeric,
  expected_balance numeric,
  discrepancy numeric,
  status text NOT NULL CHECK (status IN ('open','closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sale','cash_in','cash_out','opening','closing')),
  amount numeric NOT NULL,
  reason text,
  payment_method text CHECK (payment_method IN ('cash','card','transfer','mixed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_register_id ON public.cash_register_sessions (register_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON public.cash_movements (session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON public.cash_movements (type);

COMMIT;
