-- FORCE ADMIN ROLE
-- Run this to explicitly make yourself an admin

-- 1. Update profile role
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- 2. Update/Insert user_roles (just in case)
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin';

-- 3. Verify the result
SELECT 'SUCCESS' as status, id, role FROM public.profiles WHERE id = auth.uid();
