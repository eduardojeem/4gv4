CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
                jsonb_build_object('trigger', 'log_settings_change')
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$;
