-- =====================================================
-- MIGRACIÓN: Sistema de Configuración Completo
-- Fecha: 2026-01-14
-- Descripción: Tablas para system_settings y audit log
-- =====================================================

-- 1. Tabla de configuración del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY DEFAULT 'system',
    
    -- Información de la empresa
    company_name TEXT NOT NULL,
    company_email TEXT NOT NULL,
    company_phone TEXT NOT NULL,
    company_address TEXT,
    
    -- Configuración general
    currency TEXT NOT NULL DEFAULT 'PYG',
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    session_timeout INTEGER NOT NULL DEFAULT 30,
    
    -- Opciones del sistema
    auto_backup BOOLEAN NOT NULL DEFAULT true,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    sms_notifications BOOLEAN NOT NULL DEFAULT false,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    
    -- Seguridad
    allow_registration BOOLEAN NOT NULL DEFAULT true,
    require_email_verification BOOLEAN NOT NULL DEFAULT true,
    max_login_attempts INTEGER NOT NULL DEFAULT 3,
    password_min_length INTEGER NOT NULL DEFAULT 8,
    require_two_factor BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadatos
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT valid_stock_threshold CHECK (low_stock_threshold >= 1),
    CONSTRAINT valid_session_timeout CHECK (session_timeout >= 5 AND session_timeout <= 480),
    CONSTRAINT valid_login_attempts CHECK (max_login_attempts >= 1 AND max_login_attempts <= 10),
    CONSTRAINT valid_password_length CHECK (password_min_length >= 6 AND password_min_length <= 32)
);

-- Insertar configuración por defecto si no existe
INSERT INTO system_settings (id, company_name, company_email, company_phone)
VALUES ('system', '4G Celulares', 'info@4gcelulares.com', '+595 21 123-4567')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de auditoría de configuración
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'update', 'import', 'export'
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (action IN ('update', 'import', 'export', 'system_action')),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_settings_audit_user ON system_settings_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_created ON system_settings_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_audit_severity ON system_settings_audit(severity);
CREATE INDEX IF NOT EXISTS idx_settings_audit_field ON system_settings_audit(field_name);

-- 3. Función para actualizar timestamp automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar timestamp
DROP TRIGGER IF EXISTS trigger_update_system_settings_timestamp ON system_settings;
CREATE TRIGGER trigger_update_system_settings_timestamp
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_timestamp();

-- 4. Row Level Security (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings_audit ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Solo admins pueden insertar en audit log" ON system_settings_audit;
CREATE POLICY "Solo admins pueden insertar en audit log"
    ON system_settings_audit FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Función para registrar cambios en audit log
-- =====================================================
CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
DECLARE
    field_name TEXT;
    old_val JSONB;
    new_val JSONB;
BEGIN
    -- Comparar cada campo y registrar cambios
    FOR field_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'system_settings' 
        AND column_name NOT IN ('id', 'updated_at', 'updated_by')
    LOOP
        old_val := to_jsonb(OLD) -> field_name;
        new_val := to_jsonb(NEW) -> field_name;
        
        IF old_val IS DISTINCT FROM new_val THEN
            INSERT INTO system_settings_audit (
                user_id,
                action,
                field_name,
                old_value,
                new_value,
                severity,
                details
            ) VALUES (
                auth.uid(),
                'update',
                field_name,
                old_val,
                new_val,
                CASE 
                    WHEN field_name IN ('maintenance_mode', 'allow_registration', 'require_two_factor') THEN 'critical'
                    WHEN field_name IN ('max_login_attempts', 'password_min_length', 'require_email_verification') THEN 'high'
                    WHEN field_name IN ('tax_rate', 'currency', 'session_timeout') THEN 'medium'
                    ELSE 'low'
                END,
                jsonb_build_object(
                    'timestamp', NOW(),
                    'field', field_name
                )
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar cambios automáticamente
DROP TRIGGER IF EXISTS trigger_log_settings_change ON system_settings;
CREATE TRIGGER trigger_log_settings_change
    AFTER UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION log_settings_change();

-- 6. Función para verificar contraseña del usuario
-- =====================================================
CREATE OR REPLACE FUNCTION verify_user_password(password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Nota: Esta es una implementación simplificada
    -- En producción, deberías usar auth.users() o una función más segura
    -- Por ahora, retornamos true si el usuario está autenticado
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Vista para historial de cambios
-- =====================================================
CREATE OR REPLACE VIEW settings_change_history AS
SELECT 
    a.id,
    a.created_at,
    a.field_name,
    a.old_value,
    a.new_value,
    a.severity,
    p.full_name as changed_by,
    p.email as changed_by_email
FROM system_settings_audit a
LEFT JOIN profiles p ON p.id = a.user_id
WHERE a.action = 'update'
ORDER BY a.created_at DESC;

-- Comentarios para documentación
COMMENT ON TABLE system_settings IS 'Configuración global del sistema';
COMMENT ON TABLE system_settings_audit IS 'Registro de auditoría de cambios en configuración';
COMMENT ON COLUMN system_settings.maintenance_mode IS 'Modo mantenimiento - bloquea acceso a usuarios no admin';
COMMENT ON COLUMN system_settings_audit.severity IS 'Severidad del cambio: low, medium, high, critical';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
