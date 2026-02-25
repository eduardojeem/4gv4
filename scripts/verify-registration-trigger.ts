
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envConfig = dotenv.parse(fs.readFileSync(envPath))

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyRegistrationTrigger() {
  const testEmail = `test.auto.${Date.now()}@example.com`
  const testPassword = 'Password123!'
  const testName = 'Test Automation User'

  console.log(`1. Creating test user: ${testEmail}`)
  
  // 1. Create User
  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: testName
    }
  })

  if (createError || !user) {
    console.error('Failed to create user:', createError)
    process.exit(1)
  }

  console.log(`   User created with ID: ${user.id}`)

  // 2. Wait for trigger
  console.log('2. Waiting for triggers to fire (3s)...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // 3. Check Profile
  console.log('3. Checking Profile...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('   ❌ Profile NOT found:', profileError.message)
  } else {
    console.log('   ✅ Profile found:')
    console.log(`      - Role: ${profile.role}`)
    console.log(`      - Name: ${profile.full_name}`)
  }

  // 4. Check Customer
  console.log('4. Checking Customer...')
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('profile_id', user.id)
    .single()

  if (customerError) {
    console.error('   ❌ Customer NOT found:', customerError.message)
  } else {
    console.log('   ✅ Customer found:')
    console.log(`      - ID: ${customer.id}`)
    console.log(`      - Email: ${customer.email}`)
    console.log(`      - Name: ${customer.name}`)
    console.log(`      - Type: ${customer.customer_type}`)
  }

  // 5. Clean up
  console.log('5. Cleaning up...')
  await supabase.auth.admin.deleteUser(user.id)
  // Note: Cascading deletes should handle profile and customer if set up correctly, 
  // otherwise we might leave orphans, but for a test script it's okay-ish or we can try to delete manually if needed.
  // Assuming standard Supabase cascade on auth.users -> public.profiles
  
  console.log('   Test user deleted.')

  if (profile && customer) {
    console.log('\n🎉 SUCCESS: Automation verification passed!')
  } else {
    console.log('\n❌ FAILURE: Automation verification failed.')
    process.exit(1)
  }
}

verifyRegistrationTrigger()
