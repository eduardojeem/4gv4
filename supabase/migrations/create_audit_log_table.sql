-- Crear tabla audit_log con la estructura correcta
-- Ejecutar este script PRIMERO en Supabase SQL Editor

-- 1. Eliminar tabla existente si tiene estructura incorrecta (CUIDADO: esto borra datos)
-- DROP TABLE IF EXISTS public.audit_log CASCADE;

-- 2. Crear tabla audit_log con estructura completa
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL DEFAULT 'unknown',
    resource_id TEXT,
    old_values JSONB,
    new_values JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Verificar si la tabla ya existe y tiene las columnas correctas
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Verificar si la columna 'resource' existe
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'resource'
    ) INTO column_exists;
    
    -- Si no existe, agregarla
    IF NOT column_exists THEN
        ALTER TABLE public.audit_log ADD COLUMN resource TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE 'Columna resource agregada a audit_log';
    ELSE
        RAISE NOTICE 'Columna resource ya existe en audit_log';
    END IF;
    
    -- Verificar otras columnas importantes
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'new_values'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE public.audit_log ADD COLUMN new_values JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Columna new_values agregada a audit_log';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'old_values'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE public.audit_log ADD COLUMN old_values JSONB;
        RAISE NOTICE 'Columna old_values agregada a audit_log';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'ip_address'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE public.audit_log ADD COLUMN ip_address INET;
        RAISE NOTICE 'Columna ip_address agregada a audit_log';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'user_agent'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE public.audit_log ADD COLUMN user_agent TEXT;
        RAISE NOTICE 'Columna user_agent agregada a audit_log';
    END IF;
END $$;

-- 4. Habilitar Row Level Security
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_log;
CREATE POLICY "Admins can view audit logs" ON public.audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Allow audit log insertion" ON public.audit_log;
CREATE POLICY "Allow audit log insertion" ON public.audit_log
    FOR INSERT WITH CHECK (true);

-- 6. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log(resource);

-- 7. Agregar comentarios
COMMENT ON TABLE public.audit_log IS 'Registro de auditoría del sistema';
COMMENT ON COLUMN public.audit_log.user_id IS 'ID del usuario que realizó la acción';
COMMENT ON COLUMN public.audit_log.action IS 'Tipo de acción realizada';
COMMENT ON COLUMN public.audit_log.resource IS 'Recurso afectado por la acción';
COMMENT ON COLUMN public.audit_log.resource_id IS 'ID específico del recurso';
COMMENT ON COLUMN public.audit_log.old_values IS 'Valores anteriores (para updates/deletes)';
COMMENT ON COLUMN public.audit_log.new_values IS 'Valores nuevos (para creates/updates)';
COMMENT ON COLUMN public.audit_log.ip_address IS 'Dirección IP del usuario';
COMMENT ON COLUMN public.audit_log.user_agent IS 'User agent del navegador';

-- 8. Mostrar estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_log' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Verificar que todo esté correcto
SELECT 'Tabla audit_log creada correctamente' as status;