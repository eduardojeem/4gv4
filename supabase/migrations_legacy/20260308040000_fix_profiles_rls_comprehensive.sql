-- Comprehensive RLS fix for profiles table
-- Ensure users can insert, update, and view their own profiles

-- Enable RLS (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting or duplicate policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- 1. VIEW Policy
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- 2. INSERT Policy
-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. UPDATE Policy
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 4. READ Policy for other users (optional, depending on app needs)
-- Allow authenticated users to view basic info of other profiles (often needed for UI)
-- We can restrict columns in the query, but RLS applies to rows.
-- Let's allow authenticated users to view ALL profiles for now to prevent "missing profile" errors in UI when viewing other users (e.g. sales created by others)
CREATE POLICY "Authenticated users can view all profiles" ON profiles
    FOR SELECT TO authenticated USING (true);
