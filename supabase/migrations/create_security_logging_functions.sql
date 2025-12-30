-- Funciones para logging automático de eventos de seguridad
-- Estas funciones se pueden llamar desde la aplicación para registrar eventos

-- Función para registrar eventos de autenticación
CREATE OR REPLACE FUNCTION public.log_auth_event(
    p_user_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT 'login',
    p_success BOOLEAN DEFAULT TRUE,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
    event_severity TEXT;
BEGIN
    -- Determinar severidad basada en el tipo de evento
    CASE 
        WHEN p_action = 'login' AND p_success THEN
            event_severity := 'low';
        WHEN p_action = 'login_failed' THEN
            event_severity := 'medium';
        WHEN p_action = 'password_change' THEN
            event_severity := 'low';
        WHEN p_action = 'role_change' THEN
            event_severity := 'high';
        WHEN p_action = 'permission_denied' THEN
            event_severity := 'medium';
        WHEN p_action = 'suspicious_activity' THEN
            event_severity := 'high';
        WHEN p_action = 'account_locked' THEN
            event_severity := 'critical';
        ELSE
            event_severity := 'low';
    END CASE;

    -- Insertar el log
    INSERT INTO public.audit_log (
        user_id,
        action,
        resource,
        resource_id,
        new_values,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_user_id,
        p_action,
        'auth',
        COALESCE(p_user_id::text, 'unknown'),
        p_details || jsonb_build_object('severity', event_severity, 'success', p_success),
        p_ip_address,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar eventos de datos (CRUD)
CREATE OR REPLACE FUNCTION public.log_data_event(
    p_user_id UUID DEFAULT auth.uid(),
    p_action TEXT DEFAULT 'read',
    p_resource TEXT DEFAULT 'unknown',
    p_resource_id TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
    event_severity TEXT;
BEGIN
    -- Determinar severidad basada en el tipo de acción
    CASE 
        WHEN p_action = 'create' THEN
            event_severity := 'low';
        WHEN p_action = 'read' THEN
            event_severity := 'low';
        WHEN p_action = 'update' THEN
            event_severity := 'low';
        WHEN p_action = 'delete' THEN
            event_severity := 'medium';
        WHEN p_action = 'bulk_operation' THEN
            event_severity := 'medium';
        WHEN p_action = 'data_export' THEN
            event_severity := 'medium';
        ELSE
            event_severity := 'low';
    END CASE;

    -- Insertar el log
    INSERT INTO public.audit_log (
        user_id,
        action,
        resource,
        resource_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_user_id,
        p_action,
        p_resource,
        p_resource_id,
        p_old_values,
        p_new_values || jsonb_build_object('severity', event_severity),
        p_ip_address,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar eventos de sistema
CREATE OR REPLACE FUNCTION public.log_system_event(
    p_action TEXT DEFAULT 'system_event',
    p_resource TEXT DEFAULT 'system',
    p_details JSONB DEFAULT '{}'::jsonb,
    p_severity TEXT DEFAULT 'low',
    p_ip_address INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    -- Insertar el log del sistema
    INSERT INTO public.audit_log (
        user_id,
        action,
        resource,
        resource_id,
        new_values,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        NULL, -- Eventos del sistema no tienen usuario
        p_action,
        p_resource,
        'system',
        p_details || jsonb_build_object('severity', p_severity),
        p_ip_address,
        'System',
        NOW()
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar logs antiguos (mantenimiento)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
    p_days_to_keep INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Solo admins pueden ejecutar esta función
    IF NOT (public.get_user_role() IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Acceso denegado: se requieren permisos de administrador';
    END IF;

    -- Eliminar logs más antiguos que el número de días especificado
    DELETE FROM public.audit_log 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Registrar la limpieza
    PERFORM public.log_system_event(
        'cleanup_audit_logs',
        'maintenance',
        jsonb_build_object(
            'deleted_records', deleted_count,
            'days_kept', p_days_to_keep
        ),
        'low'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de seguridad
CREATE OR REPLACE FUNCTION public.get_security_stats(
    p_hours INTEGER DEFAULT 24
) RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_events INTEGER;
    critical_events INTEGER;
    high_risk_events INTEGER;
    failed_attempts INTEGER;
    unique_users INTEGER;
    unique_ips INTEGER;
BEGIN
    -- Solo usuarios con permisos pueden ver estadísticas
    IF NOT public.has_permission('settings.read') THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere permiso settings.read';
    END IF;

    -- Calcular estadísticas para el período especificado
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE new_values->>'severity' = 'critical'),
        COUNT(*) FILTER (WHERE new_values->>'severity' = 'high'),
        COUNT(*) FILTER (WHERE action LIKE '%failed%' OR action = 'permission_denied'),
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
        COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL)
    INTO 
        total_events,
        critical_events,
        high_risk_events,
        failed_attempts,
        unique_users,
        unique_ips
    FROM public.audit_log 
    WHERE created_at >= NOW() - INTERVAL '1 hour' * p_hours;

    -- Construir objeto JSON con las estadísticas
    stats := jsonb_build_object(
        'totalEvents', total_events,
        'criticalEvents', critical_events,
        'highRiskEvents', high_risk_events,
        'failedAttempts', failed_attempts,
        'uniqueUsers', unique_users,
        'uniqueIPs', unique_ips,
        'period_hours', p_hours,
        'generated_at', NOW()
    );

    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos necesarios
GRANT EXECUTE ON FUNCTION public.log_auth_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_data_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_system_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_stats TO authenticated;

-- Comentarios para documentación
COMMENT ON FUNCTION public.log_auth_event IS 'Registra eventos de autenticación y autorización';
COMMENT ON FUNCTION public.log_data_event IS 'Registra eventos de manipulación de datos (CRUD)';
COMMENT ON FUNCTION public.log_system_event IS 'Registra eventos del sistema';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Limpia logs de auditoría antiguos (solo admins)';
COMMENT ON FUNCTION public.get_security_stats IS 'Obtiene estadísticas de seguridad para el período especificado';