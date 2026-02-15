-- =====================================================
-- TABLA: authorized_persons
-- Descripción: Personas autorizadas por los clientes para retirar equipos
-- =====================================================

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS public.authorized_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    document_number TEXT NOT NULL,
    phone TEXT,
    relationship TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_authorized_persons_profile_id ON public.authorized_persons(profile_id);
CREATE INDEX IF NOT EXISTS idx_authorized_persons_document ON public.authorized_persons(document_number);

-- 3. Habilitar RLS
ALTER TABLE public.authorized_persons ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
DROP POLICY IF EXISTS "Users can view their own authorized persons" ON public.authorized_persons;
CREATE POLICY "Users can view their own authorized persons"
    ON public.authorized_persons
    FOR SELECT
    TO authenticated
    USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can insert their own authorized persons" ON public.authorized_persons;
CREATE POLICY "Users can insert their own authorized persons"
    ON public.authorized_persons
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update their own authorized persons" ON public.authorized_persons;
CREATE POLICY "Users can update their own authorized persons"
    ON public.authorized_persons
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can delete their own authorized persons" ON public.authorized_persons;
CREATE POLICY "Users can delete their own authorized persons"
    ON public.authorized_persons
    FOR DELETE
    TO authenticated
    USING (auth.uid() = profile_id);

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_authorized_persons_updated_at ON public.authorized_persons;
CREATE TRIGGER trigger_authorized_persons_updated_at
    BEFORE UPDATE ON public.authorized_persons
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Comentarios
COMMENT ON TABLE public.authorized_persons IS 'Almacena personas autorizadas por clientes para retirar equipos';
COMMENT ON COLUMN public.authorized_persons.profile_id IS 'ID del cliente que autoriza';

-- Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Tabla authorized_persons creada con RLS habilitado';
END $$;
