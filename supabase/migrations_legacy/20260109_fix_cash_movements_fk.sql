
-- Ensure cash_movements exists (subset of fields just in case)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    reason TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Drop old FK if exists (might be pointing to cash_register_sessions or something else)
ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_session_id_fkey;

-- Add correct FK pointing to cash_closures
ALTER TABLE public.cash_movements
    ADD CONSTRAINT cash_movements_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.cash_closures(id)
    ON DELETE CASCADE;

-- Grant permissions just in case
GRANT ALL ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

-- Ensure RLS is enabled
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Add policy for inserting (broad for now to fix the error)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.cash_movements;
CREATE POLICY "Enable insert for authenticated users only" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Add policy for select
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.cash_movements;
CREATE POLICY "Enable select for authenticated users only" ON public.cash_movements FOR SELECT TO authenticated USING (true);
