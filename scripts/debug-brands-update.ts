import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugBrandsUpdate() {
  console.log('🔍 Debugging Brands Update Issue\n')

  // 1. Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    console.error('❌ Not authenticated. Please login first.')
    console.log('Run this script after logging in to the application.')
    return
  }

  console.log('✅ User authenticated:', user.email)
  console.log('User ID:', user.id)

  // 2. Check user role and permissions
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, permissions')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message)
  } else {
    console.log('\n📋 User Profile:')
    console.log('Role:', profile?.role)
    console.log('Permissions:', profile?.permissions)
  }

  // 3. Check RLS policies on brands table
  console.log('\n🔐 Checking RLS Policies on brands table...')
  const policiesResult = await supabase
    .rpc('get_policies', { table_name: 'brands' })
  
  const { data: policies, error: policiesError } = policiesResult

  if (policiesError) {
    console.log('⚠️  Cannot fetch policies directly:', policiesError.message)
  } else if (policies) {
    console.log('Policies:', policies)
  }

  // 4. Try to read brands
  console.log('\n📖 Testing READ access to brands...')
  const { data: brands, error: readError } = await supabase
    .from('brands')
    .select('*')
    .limit(5)

  if (readError) {
    console.error('❌ Cannot read brands:', readError.message)
  } else {
    console.log(`✅ Can read brands (${brands?.length || 0} found)`)
    if (brands && brands.length > 0) {
      console.log('Sample brand:', brands[0])
    }
  }

  // 5. Try to update a brand (if exists)
  if (brands && brands.length > 0) {
    const testBrand = brands[0]
    console.log(`\n✏️  Testing UPDATE access on brand: ${testBrand.name}`)
    
    const { data: updated, error: updateError } = await supabase
      .from('brands')
      .update({ 
        description: testBrand.description || 'Test update',
        updated_at: new Date().toISOString()
      })
      .eq('id', testBrand.id)
      .select()

    if (updateError) {
      console.error('❌ Cannot update brand:', updateError.message)
      console.error('Error details:', updateError)
    } else {
      console.log('✅ Update successful!')
      console.log('Updated brand:', updated)
    }
  }

  // 6. Check if there are conflicting policies
  console.log('\n🔍 Checking for policy conflicts...')
  const allPoliciesResult = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'brands')
  
  const { data: allPolicies } = allPoliciesResult

  if (allPolicies) {
    console.log(`Found ${allPolicies.length} policies on brands table`)
    allPolicies.forEach((policy: any) => {
      console.log(`- ${policy.policyname}: ${policy.cmd} (${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`)
    })
  }
}

debugBrandsUpdate().catch(console.error)
