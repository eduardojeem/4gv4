-- ============================================================================
-- FIX ALL RLS VULNERABILITIES - CORRECCIÓN COMPLETA
-- ============================================================================
-- Este script corrige TODAS las vulnerabilidades detectadas:
-- 1. customers - UPDATE permisivo
-- 2. cash_closures - ALL permisivo
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMERS (CRÍTICO - UPDATE permisivo)
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '🔧 Iniciando corrección de vulnerabilidades RLS...';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Corrigiendo CUSTOMERS...';
    
    DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_delete_admin" ON public.customers;
    
    CREATE POLICY "customers_insert_staff" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (public.is_manager() OR public.is_admin() OR public.is_cashier());
    
    CREATE POLICY "customers_update_staff" ON public.customers
    FOR UPDATE TO authenticated
    USING (public.is_manager() OR public.is_admin())
    WITH CHECK (public.is_manager() OR public.is_admin());
    
    CREATE POLICY "customers_delete_admin" ON public.customers
    FOR DELETE TO authenticated
    USING (public.is_admin());
    
    RAISE NOTICE '✅ CUSTOMERS corregido';
END $$;

-- ============================================================================
-- 2. CASH_CLOSURES (CRÍTICO - ALL permisivo)
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '📋 Corrigiendo CASH_CLOSURES...';
    
    DROP POLICY IF EXISTS "Allow all operations on cash_closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can view closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can create closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "Administradores y vendedores pueden insertar cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_read_manager_admin" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_write_manager_admin" ON public.cash_closures;
    
    CREATE POLICY "cash_closures_read_manager_admin" ON public.cash_closures
    FOR SELECT TO authenticated
    USING (public.is_manager() OR public.is_admin());
    
    CREATE POLICY "cash_closures_write_manager_admin" ON public.cash_closures
    FOR ALL TO authenticated
    USING (public.is_manager() OR public.is_admin())
    WITH CHECK (public.is_manager() OR public.is_admin());
    
    RAISE NOTICE '✅ CASH_CLOSURES corregido';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ CORRECCIÓN COMPLETADA';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- Verificación final
DO $$ 
DECLARE
    v_critical_count INTEGER;
    v_customers_issues INTEGER;
    v_cash_closures_issues INTEGER;
BEGIN
    -- Verificar customers
    SELECT COUNT(*) INTO v_customers_issues
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'customers'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
        AND (qual = 'true' OR with_check = 'true');
    
    -- Verificar cash_closures
    SELECT COUNT(*) INTO v_cash_closures_issues
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'cash_closures'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (qual = 'true' OR with_check = 'true');
    
    -- Total
    v_critical_count := v_customers_issues + v_cash_closures_issues;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTADOS:';
    RAISE NOTICE '  - customers: % políticas permisivas', v_customers_issues;
    RAISE NOTICE '  - cash_closures: % políticas permisivas', v_cash_closures_issues;
    RAISE NOTICE '';
    
    IF v_critical_count = 0 THEN
        RAISE NOTICE '✅ ¡ÉXITO TOTAL!';
        RAISE NOTICE '✅ Todas las vulnerabilidades han sido corregidas';
        RAISE NOTICE '✅ 0 políticas permisivas detectadas';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Próximos pasos:';
        RAISE NOTICE '  1. Ejecutar: scripts/check-all-critical-tables.sql';
        RAISE NOTICE '  2. Probar funcionalidad con diferentes roles';
        RAISE NOTICE '  3. Verificar logs de la aplicación';
    ELSE
        RAISE NOTICE '⚠️  Aún hay % políticas permisivas', v_critical_count;
        RAISE NOTICE '⚠️  Revisa manualmente las políticas';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

