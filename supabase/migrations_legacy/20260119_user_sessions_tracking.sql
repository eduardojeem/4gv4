-- Tabla para rastrear todas las sesiones de usuario
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  UNIQUE(session_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- RLS (Row Level Security)
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propias sesiones
CREATE POLICY "Users can view their own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propias sesiones
CREATE POLICY "Users can update their own sessions"
  ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: Sistema puede insertar sesiones
CREATE POLICY "System can insert sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (true);

-- Política: Los usuarios pueden eliminar sus propias sesiones
CREATE POLICY "Users can delete their own sessions"
  ON user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Función para actualizar last_activity automáticamente
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar last_activity
CREATE TRIGGER update_session_activity_trigger
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Función para cerrar sesiones inactivas (más de 7 días)
CREATE OR REPLACE FUNCTION close_inactive_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE is_active = TRUE
    AND last_activity < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Función para obtener sesiones activas de un usuario
CREATE OR REPLACE FUNCTION get_user_active_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.session_id,
    us.user_agent,
    us.ip_address,
    us.device_type,
    us.browser,
    us.os,
    us.country,
    us.city,
    us.is_active,
    us.last_activity,
    us.created_at
  FROM user_sessions us
  WHERE us.user_id = p_user_id
    AND us.is_active = TRUE
  ORDER BY us.last_activity DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cerrar una sesión específica
CREATE OR REPLACE FUNCTION close_user_session(p_session_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cerrar todas las sesiones de un usuario excepto la actual
CREATE OR REPLACE FUNCTION close_all_user_sessions_except_current(
  p_user_id UUID,
  p_current_session_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_closed INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE user_id = p_user_id
    AND session_id != p_current_session_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE user_sessions IS 'Registro de todas las sesiones de usuario para seguimiento de seguridad';
COMMENT ON COLUMN user_sessions.session_id IS 'ID único de la sesión de Supabase Auth';
COMMENT ON COLUMN user_sessions.user_agent IS 'User agent del navegador/dispositivo';
COMMENT ON COLUMN user_sessions.device_type IS 'Tipo de dispositivo: mobile, tablet, desktop';
COMMENT ON COLUMN user_sessions.is_active IS 'Indica si la sesión está actualmente activa';
COMMENT ON COLUMN user_sessions.last_activity IS 'Última vez que se detectó actividad en esta sesión';
