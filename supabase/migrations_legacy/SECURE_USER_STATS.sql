
-- Revocar acceso público a la vista materializada
REVOKE SELECT ON TABLE public.user_stats_cache FROM anon, authenticated;

-- Opcional: Si se necesita acceso autenticado, usar una función segura
-- GRANT SELECT ON TABLE public.user_stats_cache TO authenticated;
