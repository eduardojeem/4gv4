-- ============================================================================
-- FIX CASH_CLOSURES RLS - CORRECCIÓN URGENTE
-- ============================================================================
-- Corrige la política permisiva de ALL operations en cash_closures
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '🔧 Corrigiendo políticas de CASH_CLOSURES...';
    
    -- Eliminar TODAS las políticas existentes (permisivas y correctas)
    DROP POLICY IF EXISTS "Allow all operations on cash_closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can view closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can create closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "Administradores y vendedores pueden insertar cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_read_manager_admin" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_write_manager_admin" ON public.cash_closures;
    
    -- Crear políticas correctas basadas en roles
    CREATE POLICY "cash_closures_read_manager_admin" ON public.cash_closures
    FOR SELECT TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "cash_closures_write_manager_admin" ON public.cash_closures
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ CASH_CLOSURES: Políticas corregidas';
    RAISE NOTICE '  - SELECT: Solo managers y admins';
    RAISE NOTICE '  - INSERT/UPDATE/DELETE: Solo managers y admins';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: %', SQLERRM;
        RAISE EXCEPTION 'Falló la corrección de políticas de CASH_CLOSURES';
END $$;

-- Verificar corrección
DO $$ 
DECLARE
    v_permissive_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_permissive_count
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'cash_closures'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (qual = 'true' OR with_check = 'true');
    
    IF v_permissive_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ VERIFICACIÓN EXITOSA';
        RAISE NOTICE '✅ 0 políticas permisivas en CASH_CLOSURES';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Aún hay % políticas permisivas', v_permissive_count;
    END IF;
END $$;
