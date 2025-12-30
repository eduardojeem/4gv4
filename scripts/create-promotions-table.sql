-- Crear tabla de promociones
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value BIGINT NOT NULL, -- Porcentaje (ej. 20) o Monto fijo (ej. 5000)
    min_purchase BIGINT DEFAULT 0,
    max_discount BIGINT, -- Tope máximo de descuento (opcional)
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    usage_limit INTEGER, -- Límite total de usos (opcional)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);

-- Habilitar RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Crear políticas (permitir todo por ahora, ajustar según necesidad)
CREATE POLICY "Allow all operations on promotions" ON public.promotions FOR ALL USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo (Mock Data)
INSERT INTO public.promotions (name, code, type, value, start_date, end_date, usage_count, min_purchase, is_active)
VALUES
    ('Descuento de Verano', 'SUMMER2024', 'percentage', 20, '2024-06-01 00:00:00-04', '2024-08-31 23:59:59-04', 145, 5000, true),
    ('Liquidación Accesorios', 'ACCESORIOS30', 'percentage', 30, '2024-05-15 00:00:00-04', '2024-06-15 23:59:59-04', 89, 0, true),
    ('Envío Gratis', 'FREESHIP', 'fixed', 2500, '2024-01-01 00:00:00-04', '2024-12-31 23:59:59-04', 312, 10000, true),
    ('Black Friday Anticipado', 'BLACKPRE', 'percentage', 15, '2024-11-01 00:00:00-04', '2024-11-15 23:59:59-04', 0, 2000, true),
    ('Día de la Madre', 'MOM2024', 'percentage', 25, '2024-10-01 00:00:00-04', '2024-10-31 23:59:59-04', 256, 3000, false);
