-- Test script to verify user registration automation
-- This script tests that when a new user is created in auth.users,
-- both profile and customer records are automatically created

-- Test 1: Check current state
SELECT '=== TEST 1: Current state before test ===' as test_phase;
SELECT COUNT(*) as total_profiles FROM profiles;
SELECT COUNT(*) as total_customers FROM customers;
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- Test 2: Create a test user (simulating registration)
SELECT '=== TEST 2: Creating test user ===' as test_phase;

-- Create test user in auth.users (this will trigger handle_new_user function)
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
) VALUES (
    gen_random_uuid(),
    'test.user.automation@example.com',
    crypt('TestPassword123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"full_name": "Test User Automation"}'::jsonb
);

-- Wait a moment for triggers to execute
SELECT pg_sleep(0.5);

-- Test 3: Verify the automation worked
SELECT '=== TEST 3: Verifying automation results ===' as test_phase;

-- Check if profile was created
SELECT 
    'Profile created' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM profiles 
WHERE email = 'test.user.automation@example.com';

-- Check if customer was created
SELECT 
    'Customer created' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM customers 
WHERE email = 'test.user.automation@example.com';

-- Check if profile and customer are linked
SELECT 
    'Profile-Customer link' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM profiles p
JOIN customers c ON c.profile_id = p.id
WHERE p.email = 'test.user.automation@example.com';

-- Show the created records
SELECT '=== TEST 4: Created records details ===' as test_phase;

SELECT 'Profile record:' as info;
SELECT id, email, full_name, role, created_at
FROM profiles 
WHERE email = 'test.user.automation@example.com';

SELECT 'Customer record:' as info;
SELECT id, profile_id, name, email, customer_type, segment, status, created_at
FROM customers 
WHERE email = 'test.user.automation@example.com';

-- Test 5: Cleanup (optional - comment out if you want to keep test data)
SELECT '=== TEST 5: Cleanup (optional) ===' as test_phase;

-- Get the test user ID
WITH test_user AS (
    SELECT id FROM auth.users WHERE email = 'test.user.automation@example.com'
)
-- Delete related records first (due to foreign key constraints)
DELETE FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE email = 'test.user.automation@example.com');
DELETE FROM profiles WHERE email = 'test.user.automation@example.com';
DELETE FROM auth.users WHERE email = 'test.user.automation@example.com';

SELECT 'Test user and related records deleted' as cleanup_result;

-- Final verification
SELECT '=== FINAL VERIFICATION ===' as test_phase;
SELECT COUNT(*) as final_profiles FROM profiles;
SELECT COUNT(*) as final_customers FROM customers;
SELECT COUNT(*) as final_auth_users FROM auth.users;