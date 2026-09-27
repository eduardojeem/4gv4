-- Migration: System Settings Security Implementation
-- Date: 2026-01-14
-- Description: Implementa tablas seguras para configuración del sistema y auditoría

-- ============================================================================
-- 1. TABLA DE CONFIGURACIÓN DEL SISTEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY DEFAULT 'system',
    company_name TEXT NOT NULL,
    company_email TEXT NOT NULL CHECK (company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    company_phone TEXT NOT NULL,
    company_address TEXT,
    currency TEXT NOT NULL DEFAULT 'PYG' CHECK (currency IN ('PYG', 'USD', 'EUR', 'MXN')),
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 1),
    session_timeout INTEGER NOT NULL DEFAULT 30 CHECK (session_timeout >= 5 AND session_timeout <= 480),
    auto_backup BOOLEAN NOT NULL DEFAULT true,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    sms_notifications BOOLEAN NOT NULL DEFAULT false,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    allow_registration BOOLEAN NOT NULL DEFAULT true,
    require_email_verification BOOLEAN NOT NULL DEFAULT true,
    max_login_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_login_attempts >= 1 AND max_login_attempts <= 10),
    password_min_length INTEGER NOT NULL DEFAULT 8 CHECK (password_min_length >= 6 AND password_min_length <= 32),
    require_two_factor BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insertar configuración por defecto si no existe
INSERT INTO system_settings (
    id,
    company_name,
    company_email,
    company_phone,
    company_address,
    currency,
    tax_rate
) VALUES (
    'system',
    '4G celulares',
    'info@4gcelulares.com',
    '+595 21 123-4567',
    'Av. Mariscal López 1234, Asunción, Paraguay',
    'PYG',
    10.00
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. TABLA DE AUDITORÍA DE CONFIGURACIÓN
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL CHECK (action IN ('update', 'import', 'export', 'system_action')),
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_settings_audit_user ON system_settings_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_created ON system_settings_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_audit_action ON system_settings_audit(action);
CREATE INDEX IF NOT EXISTS idx_settings_audit_severity ON system_settings_audit(severity);

-- ============================================================================
-- 3. TABLA DE RATE LIMITING
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action ON rate_limit_settings(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_settings(window_start);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para system_settings
DROP POLICY IF EXISTS "Solo admins pueden leer settings" ON system_settings;
CREATE POLICY "Solo admins pueden leer settings"
    ON system_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Solo admins pueden actualizar settings" ON system_settings;
CREATE POLICY "Solo admins pueden actualizar settings"
    ON system_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Políticas para system_settings_audit
DROP POLICY IF EXISTS "Solo admins pueden ver audit log" ON system_settings_audit;
CREATE POLICY "Solo admins pueden ver audit log"
    ON system_settings_audit FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Sistema puede insertar en audit log" ON system_settings_audit;
CREATE POLICY "Sistema puede insertar en audit log"
    ON system_settings_audit FOR INSERT
    WITH CHECK (true); -- Permitir inserts desde funciones del sistema

-- Políticas para rate_limit_settings
DROP POLICY IF EXISTS "Usuarios pueden ver su propio rate limit" ON rate_limit_settings;
CREATE POLICY "Usuarios pueden ver su propio rate limit"
    ON rate_limit_settings FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Sistema puede gestionar rate limits" ON rate_limit_settings;
CREATE POLICY "Sistema puede gestionar rate limits"
    ON rate_limit_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 5. FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para limpiar rate limits antiguos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_settings
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Obtener el inicio de la ventana actual
    SELECT window_start, attempt_count INTO v_window_start, v_count
    FROM rate_limit_settings
    WHERE user_id = p_user_id AND action_type = p_action_type;
    
    -- Si no existe registro o la ventana expiró, crear nuevo
    IF v_window_start IS NULL OR v_window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL THEN
        INSERT INTO rate_limit_settings (user_id, action_type, attempt_count, window_start)
        VALUES (p_user_id, p_action_type, 1, NOW())
        ON CONFLICT (user_id, action_type) 
        DO UPDATE SET attempt_count = 1, window_start = NOW();
        RETURN TRUE;
    END IF;
    
    -- Si está dentro del límite, incrementar contador
    IF v_count < p_max_attempts THEN
        UPDATE rate_limit_settings
        SET attempt_count = attempt_count + 1
        WHERE user_id = p_user_id AND action_type = p_action_type;
        RETURN TRUE;
    END IF;
    
    -- Límite excedido
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

-- Permitir a usuarios autenticados ejecutar funciones
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO postgres;

-- ============================================================================
-- 7. COMENTARIOS
-- ============================================================================

COMMENT ON TABLE system_settings IS 'Configuración global del sistema con validaciones de seguridad';
COMMENT ON TABLE system_settings_audit IS 'Registro de auditoría de todos los cambios en configuración';
COMMENT ON TABLE rate_limit_settings IS 'Control de rate limiting para acciones sensibles';
COMMENT ON FUNCTION check_rate_limit IS 'Verifica si un usuario puede realizar una acción según rate limits';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Limpia registros antiguos de rate limiting (ejecutar periódicamente)';
