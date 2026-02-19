CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
