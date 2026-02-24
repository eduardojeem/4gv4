-- Secure customers table: Restrict DELETE and UPDATE permissions
-- This migration replaces overly permissive policies with strict role-based access

-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;

-- 2. Create strict DELETE policy (Only Admins and Managers)
CREATE POLICY "Only admins and managers can delete customers" 
ON public.customers
FOR DELETE 
TO authenticated
USING (
    public.is_admin() OR public.is_manager()
);

-- 3. Create strict UPDATE policy
-- Admins/Managers can update everyone
-- Users can only update their own record (linked via profile_id)
CREATE POLICY "Admins/Managers update all, Users update self" 
ON public.customers
FOR UPDATE 
TO authenticated
USING (
    public.is_admin() OR 
    public.is_manager() OR 
    (profile_id = auth.uid())
)
WITH CHECK (
    public.is_admin() OR 
    public.is_manager() OR 
    (profile_id = auth.uid())
);

-- 4. Create strict INSERT policy
-- Admins/Managers can insert for anyone
-- Users can only insert for themselves (usually handled by trigger, but for direct API calls)
CREATE POLICY "Admins/Managers insert all, Users insert self" 
ON public.customers
FOR INSERT 
TO authenticated
WITH CHECK (
    public.is_admin() OR 
    public.is_manager() OR 
    (profile_id = auth.uid())
);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas de seguridad de clientes actualizadas';
    RAISE NOTICE '🔒 DELETE restringido a admins y managers';
    RAISE NOTICE '🔒 UPDATE restringido a propietarios y staff';
END $$;
