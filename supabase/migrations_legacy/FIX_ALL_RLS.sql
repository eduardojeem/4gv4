-- ============================================================================
-- FIX ALL RLS POLICIES (Categories & Profiles)
-- ============================================================================

-- 1. CATEGORIES: Allow all authenticated users to view/manage for now (to unblock)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
CREATE POLICY "Authenticated users can view categories" ON public.categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;
CREATE POLICY "Authenticated users can manage categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. PROFILES: Ensure users can read their own profile (CRITICAL for AuthContext)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 3. USER_ROLES: Ensure users can read their own roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. ADMIN OVERRIDES: Allow admins to view/manage everything
-- Note: This relies on the user ALREADY having the admin role resolved. 
-- If profiles RLS is broken, this won't work, which is why step 2 is critical.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. FIX CATEGORIES SEQUENCE (Not needed for UUID)
-- UUIDs do not use sequences, so we skip this step.

DO $$
BEGIN
    RAISE NOTICE '✅ All RLS policies updated. Profiles and Categories should now be accessible.';
END $$;
