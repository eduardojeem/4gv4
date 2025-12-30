-- Insertar logs de seguridad de ejemplo para testing
-- Este script inserta datos de prueba en la tabla audit_log

-- Obtener el ID del usuario actual (si existe)
DO $$
DECLARE
    current_user_id UUID;
    admin_user_id UUID;
    test_user_id UUID;
BEGIN
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
    
    -- Crear un usuario de prueba si no existe
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email = 'test@4gcelulares.com'
    LIMIT 1;
    
    -- Si tenemos al menos un usuario, insertar logs de ejemplo
    IF admin_user_id IS NOT NULL THEN
        
        -- Log 1: Inicio de sesión exitoso
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
            admin_user_id,
            'login',
            'auth',
            admin_user_id::text,
            '{"success": true, "method": "email"}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '2 hours'
        );
        
        -- Log 2: Intento de acceso fallido
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
            NULL, -- Usuario desconocido
            'login_failed',
            'auth',
            'unknown',
            '{"error": "invalid_credentials", "attempts": 3}'::jsonb,
            '203.0.113.45',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            NOW() - INTERVAL '1 hour'
        );
        
        -- Log 3: Cambio de contraseña
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
            admin_user_id,
            'password_change',
            'auth',
            admin_user_id::text,
            '{"method": "self_service"}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '30 minutes'
        );
        
        -- Log 4: Acceso desde IP desconocida
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
            admin_user_id,
            'suspicious_activity',
            'auth',
            admin_user_id::text,
            '{"reason": "unknown_ip", "location": "Unknown"}'::jsonb,
            '198.51.100.23',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            NOW() - INTERVAL '15 minutes'
        );
        
        -- Log 5: Creación de producto
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
            admin_user_id,
            'create',
            'products',
            'prod_' || generate_random_uuid()::text,
            '{"name": "iPhone 15 Pro", "price": 5500000, "category": "smartphones"}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '45 minutes'
        );
        
        -- Log 6: Exportación de datos
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
            admin_user_id,
            'data_export',
            'customers',
            'export_' || extract(epoch from now())::text,
            '{"format": "csv", "records": 150}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '10 minutes'
        );
        
        -- Log 7: Eliminación de registro
        INSERT INTO public.audit_log (
            user_id, 
            action, 
            resource, 
            resource_id, 
            old_values, 
            ip_address, 
            user_agent,
            created_at
        ) VALUES (
            admin_user_id,
            'delete',
            'products',
            'prod_deleted_123',
            '{"name": "Producto Obsoleto", "price": 100000}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '5 minutes'
        );
        
        -- Log 8: Cambio de rol (crítico)
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
            admin_user_id,
            'role_change',
            'users',
            COALESCE(test_user_id, admin_user_id)::text,
            '{"role": "vendedor"}'::jsonb,
            '{"role": "admin"}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '1 minute'
        );
        
        -- Log 9: Acceso denegado
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
            admin_user_id,
            'permission_denied',
            'admin',
            'security_panel',
            '{"required_permission": "settings.read", "user_role": "vendedor"}'::jsonb,
            '192.168.1.150',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '3 minutes'
        );
        
        -- Log 10: Operación masiva
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
            admin_user_id,
            'bulk_operation',
            'inventory',
            'bulk_update_' || extract(epoch from now())::text,
            '{"operation": "price_update", "affected_records": 25}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '20 minutes'
        );
        
        RAISE NOTICE 'Se insertaron 10 logs de seguridad de ejemplo exitosamente.';
    ELSE
        RAISE NOTICE 'No se encontraron usuarios en la base de datos. Crea un usuario primero.';
    END IF;
END $$;