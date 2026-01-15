-- ============================================================================
-- VERIFICACIÓN COMPLETA DE TODAS LAS TABLAS CRÍTICAS
-- ============================================================================
-- Este script verifica el estado de seguridad de todas las tablas críticas
-- ============================================================================

-- Tabla de resumen
SELECT 
    tablename,
    COUNT(*) FILTER (WHERE cmd = 'SELECT' AND qual = 'true') AS permissive_selects,
    COUNT(*) FILTER (WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND (qual = 'true' OR with_check = 'true')) AS critical_policies,
    COUNT(*) FILTER (WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND NOT (qual = 'true' OR with_check = 'true')) AS secure_policies,
    CASE 
        WHEN COUNT(*) FILTER (WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND (qual = 'true' OR with_check = 'true')) = 0 
        THEN '✅ SEGURO'
        ELSE '❌ VULNERABLE'
    END AS status
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'repairs', 
        'suppliers', 
        'supplier_products', 
        'purchase_orders', 
        'purchase_order_items', 
        'inventory_reorders', 
        'customers', 
        'repair_images', 
        'cash_movements',
        'cash_closures'
    )
GROUP BY tablename
ORDER BY 
    CASE 
        WHEN COUNT(*) FILTER (WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND (qual = 'true' OR with_check = 'true')) > 0 
        THEN 1 
        ELSE 2 
    END,
    tablename;

-- Separador
SELECT '═══════════════════════════════════════════════════════════════' AS separator;

-- Detalle de políticas problemáticas (si las hay)
SELECT 
    tablename,
    policyname,
    cmd AS operation,
    qual AS using_clause,
    with_check AS with_check_clause,
    '❌ CRÍTICO - Sin restricciones' AS issue
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'repairs', 
        'suppliers', 
        'supplier_products', 
        'purchase_orders', 
        'purchase_order_items', 
        'inventory_reorders', 
        'customers', 
        'repair_images', 
        'cash_movements',
        'cash_closures'
    )
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, cmd;

-- Separador
SELECT '═══════════════════════════════════════════════════════════════' AS separator;

-- Resumen final
DO $$ 
DECLARE
    v_critical_count INTEGER;
    v_vulnerable_tables INTEGER;
BEGIN
    -- Contar políticas críticas
    SELECT COUNT(*) INTO v_critical_count
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename IN (
            'repairs', 'suppliers', 'supplier_products', 
            'purchase_orders', 'purchase_order_items', 
            'inventory_reorders', 'customers', 
            'repair_images', 'cash_movements', 'cash_closures'
        )
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (qual = 'true' OR with_check = 'true');
    
    -- Contar tablas vulnerables
    SELECT COUNT(DISTINCT tablename) INTO v_vulnerable_tables
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename IN (
            'repairs', 'suppliers', 'supplier_products', 
            'purchase_orders', 'purchase_order_items', 
            'inventory_reorders', 'customers', 
            'repair_images', 'cash_movements', 'cash_closures'
        )
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (qual = 'true' OR with_check = 'true');
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '📊 RESUMEN DE SEGURIDAD RLS';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    IF v_critical_count = 0 THEN
        RAISE NOTICE '✅ ¡EXCELENTE! Sistema completamente seguro';
        RAISE NOTICE '✅ 0 políticas permisivas detectadas';
        RAISE NOTICE '✅ 0 tablas vulnerables';
        RAISE NOTICE '✅ Todas las operaciones de escritura están protegidas';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Score de Seguridad: 100/100';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Próximos pasos:';
        RAISE NOTICE '  1. Probar funcionalidad con diferentes roles';
        RAISE NOTICE '  2. Verificar que no hay errores en la aplicación';
        RAISE NOTICE '  3. Documentar el estado de seguridad';
    ELSE
        RAISE NOTICE '⚠️  ATENCIÓN: Se detectaron vulnerabilidades';
        RAISE NOTICE '⚠️  Políticas permisivas: %', v_critical_count;
        RAISE NOTICE '⚠️  Tablas vulnerables: %', v_vulnerable_tables;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 Acción requerida:';
        RAISE NOTICE '  Ejecutar: scripts/fix-rls-policies-direct.sql';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
