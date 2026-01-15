-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE POLÍTICAS RLS
-- ============================================================================
-- Este script verifica las políticas RLS actuales y detecta políticas permisivas
-- ============================================================================

-- Mostrar todas las políticas con USING (true) o WITH CHECK (true)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd AS operation,
    CASE 
        WHEN cmd = 'SELECT' THEN '✅ Aceptable'
        WHEN qual = 'true' OR with_check = 'true' THEN '❌ CRÍTICO'
        ELSE '✅ OK'
    END AS security_status,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true')
ORDER BY 
    CASE 
        WHEN cmd = 'SELECT' THEN 2
        ELSE 1
    END,
    tablename,
    policyname;

-- ============================================================================
-- Resumen por tabla
-- ============================================================================

SELECT 
    tablename,
    COUNT(*) FILTER (WHERE cmd != 'SELECT' AND (qual = 'true' OR with_check = 'true')) AS critical_policies,
    COUNT(*) FILTER (WHERE cmd = 'SELECT' AND qual = 'true') AS permissive_select_policies,
    COUNT(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) FILTER (WHERE cmd != 'SELECT' AND (qual = 'true' OR with_check = 'true')) > 0
ORDER BY critical_policies DESC;

-- ============================================================================
-- Verificar funciones helper de roles
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name LIKE 'is_%' THEN '✅ Función de rol encontrada'
        ELSE 'ℹ️  Otra función'
    END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('is_admin', 'is_manager', 'is_cashier', 'is_technician', 'is_staff')
ORDER BY routine_name;

-- ============================================================================
-- Políticas específicas de REPAIRS (tabla crítica)
-- ============================================================================

SELECT 
    policyname,
    cmd AS operation,
    qual AS using_clause,
    with_check AS with_check_clause,
    CASE 
        WHEN cmd = 'SELECT' AND qual = 'true' THEN '✅ Lectura pública OK'
        WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE') AND (qual = 'true' OR with_check = 'true') THEN '❌ CRÍTICO - Sin restricciones'
        ELSE '✅ Política con control de acceso'
    END AS security_assessment
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'repairs'
ORDER BY cmd, policyname;

-- ============================================================================
-- Políticas específicas de SUPPLIERS (tabla crítica)
-- ============================================================================

SELECT 
    policyname,
    cmd AS operation,
    qual AS using_clause,
    with_check AS with_check_clause,
    CASE 
        WHEN cmd = 'SELECT' AND qual = 'true' THEN '✅ Lectura pública OK'
        WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE') AND (qual = 'true' OR with_check = 'true') THEN '❌ CRÍTICO - Sin restricciones'
        ELSE '✅ Política con control de acceso'
    END AS security_assessment
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'suppliers'
ORDER BY cmd, policyname;

-- ============================================================================
-- Tablas sin RLS habilitado (CRÍTICO)
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    '❌ RLS NO HABILITADO' AS status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT IN (
        SELECT tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    )
ORDER BY tablename;
