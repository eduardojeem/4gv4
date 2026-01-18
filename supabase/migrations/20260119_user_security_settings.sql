-- Tabla para configuración de seguridad de usuarios
CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT TRUE,
  login_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- RLS (Row Level Security)
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver y editar su propia configuración
CREATE POLICY "Users can view their own security settings"
  ON user_security_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own security settings"
  ON user_security_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security settings"
  ON user_security_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_user_security_settings_updated_at
  BEFORE UPDATE ON user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_security_settings_updated_at();

-- Comentarios
COMMENT ON TABLE user_security_settings IS 'Configuración de seguridad personalizada por usuario';
COMMENT ON COLUMN user_security_settings.two_factor_enabled IS 'Indica si el usuario tiene habilitada la autenticación de dos factores';
COMMENT ON COLUMN user_security_settings.email_notifications IS 'Indica si el usuario recibe notificaciones de seguridad por email';
COMMENT ON COLUMN user_security_settings.login_alerts IS 'Indica si el usuario recibe alertas cuando inicia sesión desde un nuevo dispositivo';
