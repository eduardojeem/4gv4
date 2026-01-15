-- ============================================================================
-- FIX CUSTOMERS RLS - CORRECCIÓN URGENTE
-- ============================================================================
-- Corrige la política permisiva de UPDATE en la tabla customers
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '🔧 Corrigiendo políticas de CUSTOMERS...';
    
    -- Eliminar políticas permisivas
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_delete_admin" ON public.customers;
    
    -- Crear políticas correctas
    CREATE POLICY "customers_insert_staff" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin() OR
        public.is_cashier()
    );
    
    CREATE POLICY "customers_update_staff" ON public.customers
    FOR UPDATE TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "customers_delete_admin" ON public.customers
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
    );
    
    RAISE NOTICE '✅ CUSTOMERS: Políticas corregidas';
    RAISE NOTICE '  - INSERT: Solo managers, admins y cashiers';
    RAISE NOTICE '  - UPDATE: Solo managers y admins';
    RAISE NOTICE '  - DELETE: Solo admins';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: %', SQLERRM;
        RAISE EXCEPTION 'Falló la corrección de políticas de CUSTOMERS';
END $$;

-- Verificar corrección
DO $$ 
DECLARE
    v_permissive_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_permissive_count
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'customers'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
        AND (qual = 'true' OR with_check = 'true');
    
    IF v_permissive_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ VERIFICACIÓN EXITOSA';
        RAISE NOTICE '✅ 0 políticas permisivas en CUSTOMERS';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Aún hay % políticas permisivas', v_permissive_count;
    END IF;
END $$;
