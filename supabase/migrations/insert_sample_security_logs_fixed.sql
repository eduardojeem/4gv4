-- Insertar logs de seguridad de ejemplo (versión corregida)
-- Ejecutar DESPUÉS de create_audit_log_table.sql

DO $$
DECLARE
    current_user_id UUID;
    admin_user_id UUID;
    test_user_id UUID;
    table_exists BOOLEAN;
    resource_column_exists BOOLEAN;
BEGIN
    -- Verificar si la tabla audit_log existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audit_log' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'La tabla audit_log no existe. Ejecute primero create_audit_log_table.sql';
    END IF;
    
    -- Verificar si la columna resource existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' 
        AND table_schema = 'public' 
        AND column_name = 'resource'
    ) INTO resource_column_exists;
    
    -- Intentar obtener un usuario admin existente
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email LIKE '%admin%' OR email LIKE '%carlos%'
    LIMIT 1;
    
    -- Si no hay admin, usar el primer usuario disponible
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id 
        FROM auth.users 
        LIMIT 1;
    END IF;
    
    -- Si tenemos al menos un usuario, insertar logs de ejemplo
    IF admin_user_id IS NOT NULL THEN
        
        RAISE NOTICE 'Insertando logs de ejemplo para usuario: %', admin_user_id;
        
        -- Usar INSERT dinámico basado en la estructura de la tabla
        IF resource_column_exists THEN
            -- Tabla con columna resource (estructura completa)
            
            -- Log 1: Inicio de sesión exitoso
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'login', 'auth', admin_user_id::text,
                '{"success": true, "method": "email", "severity": "low"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '2 hours'
            );
            
            -- Log 2: Intento de acceso fallido
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                NULL, 'login_failed', 'auth', 'unknown',
                '{"error": "invalid_credentials", "attempts": 3, "severity": "medium"}'::jsonb,
                '203.0.113.45', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                NOW() - INTERVAL '1 hour'
            );
            
            -- Log 3: Cambio de contraseña
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'password_change', 'auth', admin_user_id::text,
                '{"method": "self_service", "severity": "low"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '30 minutes'
            );
            
            -- Log 4: Actividad sospechosa
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'suspicious_activity', 'auth', admin_user_id::text,
                '{"reason": "unknown_ip", "location": "Unknown", "severity": "high"}'::jsonb,
                '198.51.100.23', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                NOW() - INTERVAL '15 minutes'
            );
            
            -- Log 5: Creación de producto
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'create', 'products', 'prod_' || gen_random_uuid()::text,
                '{"name": "iPhone 15 Pro", "price": 5500000, "category": "smartphones", "severity": "low"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '45 minutes'
            );
            
            -- Log 6: Exportación de datos
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'data_export', 'customers', 'export_' || extract(epoch from now())::text,
                '{"format": "csv", "records": 150, "severity": "medium"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '10 minutes'
            );
            
            -- Log 7: Eliminación de registro
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, old_values, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'delete', 'products', 'prod_deleted_123',
                '{"name": "Producto Obsoleto", "price": 100000}'::jsonb,
                '{"severity": "medium"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '5 minutes'
            );
            
            -- Log 8: Cambio de rol (crítico)
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, old_values, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'role_change', 'users', admin_user_id::text,
                '{"role": "vendedor"}'::jsonb,
                '{"role": "admin", "severity": "high"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '1 minute'
            );
            
            -- Log 9: Acceso denegado
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'permission_denied', 'admin', 'security_panel',
                '{"required_permission": "settings.read", "user_role": "vendedor", "severity": "medium"}'::jsonb,
                '192.168.1.150', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '3 minutes'
            );
            
            -- Log 10: Operación masiva
            INSERT INTO public.audit_log (
                user_id, action, resource, resource_id, new_values, ip_address, user_agent, created_at
            ) VALUES (
                admin_user_id, 'bulk_operation', 'inventory', 'bulk_update_' || extract(epoch from now())::text,
                '{"operation": "price_update", "affected_records": 25, "severity": "medium"}'::jsonb,
                '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                NOW() - INTERVAL '20 minutes'
            );
            
        ELSE
            -- Tabla sin columna resource (estructura básica)
            RAISE NOTICE 'Tabla audit_log tiene estructura básica, insertando logs simplificados';
            
            -- Insertar logs básicos sin columna resource
            INSERT INTO public.audit_log (user_id, action, new_values, created_at) VALUES
            (admin_user_id, 'login', '{"severity": "low"}'::jsonb, NOW() - INTERVAL '2 hours'),
            (NULL, 'login_failed', '{"severity": "medium"}'::jsonb, NOW() - INTERVAL '1 hour'),
            (admin_user_id, 'password_change', '{"severity": "low"}'::jsonb, NOW() - INTERVAL '30 minutes'),
            (admin_user_id, 'suspicious_activity', '{"severity": "high"}'::jsonb, NOW() - INTERVAL '15 minutes'),
            (admin_user_id, 'permission_denied', '{"severity": "medium"}'::jsonb, NOW() - INTERVAL '5 minutes');
            
        END IF;
        
        RAISE NOTICE 'Se insertaron logs de seguridad de ejemplo exitosamente.';
        
        -- Mostrar resumen
        RAISE NOTICE 'Total de logs insertados: %', (SELECT COUNT(*) FROM public.audit_log);
        
    ELSE
        RAISE NOTICE 'No se encontraron usuarios en la base de datos. Crea un usuario primero.';
    END IF;
    
END $$;

-- Verificar los datos insertados
SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT action) as unique_actions,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log
FROM public.audit_log;

-- Mostrar algunos logs de ejemplo
SELECT 
    id,
    action,
    CASE 
        WHEN user_id IS NOT NULL THEN user_id::text 
        ELSE 'Sistema' 
    END as user_id,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_log' 
            AND column_name = 'resource'
        ) THEN (SELECT resource FROM public.audit_log al WHERE al.id = audit_log.id)
        ELSE 'N/A'
    END as resource,
    new_values->>'severity' as severity,
    created_at
FROM public.audit_log 
ORDER BY created_at DESC 
LIMIT 5;