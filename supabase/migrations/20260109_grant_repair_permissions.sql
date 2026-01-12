
-- Grant permissions for Repairs and related tables
-- This ensures authenticated users can view repairs, clients, and technicians.

-- 1. REPAIRS
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select repairs" ON public.repairs;
CREATE POLICY "Authenticated users can select repairs" ON public.repairs 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert repairs" ON public.repairs;
CREATE POLICY "Authenticated users can insert repairs" ON public.repairs 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update repairs" ON public.repairs;
CREATE POLICY "Authenticated users can update repairs" ON public.repairs 
FOR UPDATE TO authenticated 
USING (true);

-- 2. CUSTOMERS (Required for joins)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select customers" ON public.customers;
CREATE POLICY "Authenticated users can select customers" ON public.customers 
FOR SELECT TO authenticated 
USING (true);

-- 3. PROFILES (Required for technician details in joins)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select profiles" ON public.profiles;
CREATE POLICY "Authenticated users can select profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (true);

-- 4. REPAIR IMAGES
ALTER TABLE public.repair_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select repair_images" ON public.repair_images;
CREATE POLICY "Authenticated users can select repair_images" ON public.repair_images 
FOR SELECT TO authenticated 
USING (true);

-- Grant schema usage just in case
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
