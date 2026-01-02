-- Crear tabla de cierres de caja (cash_closures)
CREATE TABLE IF NOT EXISTS public.cash_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'z' para cierre diario, 'x' para parcial
    register_id TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opening_balance BIGINT DEFAULT 0,
    closing_balance BIGINT DEFAULT 0,
    income_total BIGINT DEFAULT 0,
    expense_total BIGINT DEFAULT 0,
    sales_total_cash BIGINT DEFAULT 0,
    sales_total_card BIGINT DEFAULT 0,
    sales_total_transfer BIGINT DEFAULT 0,
    sales_total_mixed BIGINT DEFAULT 0,
    movements_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON public.cash_closures(date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_register ON public.cash_closures(register_id);

-- Habilitar RLS
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

-- Política de acceso (ajustar según necesidades de seguridad)
CREATE POLICY "Allow all operations on cash_closures" ON public.cash_closures FOR ALL USING (true);
