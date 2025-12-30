-- CHECK USER ROLE AND PERMISSIONS
-- Run this to see what the database thinks about your user

SELECT 
    au.id,
    au.email,
    p.role as profile_role,
    ur.role as user_roles_role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE au.id = auth.uid();

-- Check if profiles table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- Check if you can read profiles
SELECT count(*) as profiles_readable FROM public.profiles;
