-- Check recent users and their profile/customer status
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.created_at as auth_created_at,
    p.id as profile_id,
    p.email as profile_email,
    p.role as profile_role,
    c.id as customer_id,
    c.email as customer_email,
    c.first_name,
    c.last_name
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.customers c ON c.profile_id = p.id
ORDER BY au.created_at DESC
LIMIT 5;

-- Check RLS policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Check RLS policies on customers
SELECT * FROM pg_policies WHERE tablename = 'customers';
