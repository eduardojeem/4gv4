-- =============================================================================
-- Fix: Make handle_new_user() resilient so signup never fails due to customer insert
-- Date: 2026-06-07
-- Problem: The current trigger has no EXCEPTION handler. If the INSERT INTO customers
--          fails for ANY reason (missing column, constraint violation, etc.), the
--          entire auth.users INSERT transaction is rolled back and Supabase returns
--          "Database error saving new user" (HTTP 400).
-- =============================================================================

-- 1. Ensure customers table exists with the columns the trigger needs
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT 'Usuario',
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    ruc TEXT,
    customer_type TEXT DEFAULT 'regular' CHECK (customer_type IN ('regular', 'premium', 'vip', 'empresa')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    segment TEXT DEFAULT 'regular' CHECK (segment IN ('vip', 'premium', 'regular', 'new', 'high_value', 'low_value', 'business', 'wholesale')),
    address TEXT,
    city TEXT,
    total_purchases INTEGER DEFAULT 0,
    total_repairs INTEGER DEFAULT 0,
    credit_score NUMERIC(3,1) DEFAULT 0,
    lifetime_value NUMERIC DEFAULT 0,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add columns that might be missing if table already existed
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'regular';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- 3. Remove duplicate profile_id rows (keep the most recent one per profile_id)
DELETE FROM public.customers
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY updated_at DESC, created_at DESC, id) AS rn
        FROM public.customers
        WHERE profile_id IS NOT NULL
    ) dupes
    WHERE rn > 1
);

-- Now create unique index safely
DROP INDEX IF EXISTS idx_customers_profile_id;
CREATE UNIQUE INDEX idx_customers_profile_id
    ON public.customers(profile_id)
    WHERE profile_id IS NOT NULL;

-- 4. Replace the trigger function with a resilient version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    full_name_val TEXT;
    first_name_val TEXT;
    last_name_val TEXT;
BEGIN
    -- Extract name safely from user metadata
    full_name_val := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Usuario');
    first_name_val := split_part(full_name_val, ' ', 1);
    last_name_val := COALESCE(NULLIF(TRIM(substring(full_name_val from position(' ' in full_name_val) + 1)), ''), '');

    -- Create/update profile — this should never fail since profiles schema is stable
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        full_name_val,
        'cliente'::user_role
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
        updated_at = NOW();

    -- Customer creation wrapped in its own block so failures don't kill signup
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM customers WHERE profile_id = NEW.id) THEN
            INSERT INTO customers (
                profile_id,
                name,
                first_name,
                last_name,
                email,
                phone,
                customer_type,
                segment,
                status,
                created_at,
                updated_at
            ) VALUES (
                NEW.id,
                full_name_val,
                first_name_val,
                last_name_val,
                COALESCE(NEW.email, ''),
                '',
                'regular',
                'regular',
                'active',
                NOW(),
                NOW()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Log but do NOT re-raise: user signup must succeed even if customer row fails
        RAISE WARNING '[handle_new_user] Customer insert failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Last resort: even if profile insert fails, don't block user creation
    RAISE WARNING '[handle_new_user] Profile insert failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- 5. Recreate the trigger (ensures it uses the new function version)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Done
DO $$ BEGIN
    RAISE NOTICE '✅ handle_new_user() is now resilient — signup will never fail due to customer insert errors';
END $$;
