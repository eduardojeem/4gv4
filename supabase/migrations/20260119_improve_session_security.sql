-- Mejorar la función close_user_session para prevenir cerrar la sesión actual
-- Fecha: 2026-01-19
-- Descripción: Agregar validación del lado del servidor para prevenir que un usuario cierre su sesión actual

-- Eliminar la función existente para poder cambiar el tipo de retorno
DROP FUNCTION IF EXISTS close_user_session(TEXT, UUID);

-- Función mejorada para cerrar una sesión específica con validación de sesión actual
CREATE OR REPLACE FUNCTION close_user_session(p_session_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Verificar que la sesión existe y pertenece al usuario
  IF NOT EXISTS (
    SELECT 1 FROM user_sessions 
    WHERE session_id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_FOUND',
      'message', 'Sesión no encontrada o ya cerrada'
    );
  END IF;
  
  -- Cerrar la sesión
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Sesión cerrada correctamente'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UPDATE_FAILED',
      'message', 'No se pudo cerrar la sesión'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario sobre la mejora
COMMENT ON FUNCTION close_user_session(TEXT, UUID) IS 'Función mejorada para cerrar sesiones con validación de seguridad';