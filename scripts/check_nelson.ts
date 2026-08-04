import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  const email = 'nelson25be@gmail.com'
  
  // 1. Get profile
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
  
  console.log('Profiles:', profiles)

  if (!profiles || profiles.length === 0) {
    console.log('No profile found')
    return
  }

  const profileId = profiles[0].id

  // 2. Get customers for this profile
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('profile_id', profileId)

  console.log('Customers:', customers?.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, org_id: c.organization_id })))

  if (!customers || customers.length === 0) {
    console.log('No customers linked to profile')
    
    // check if there are customers by email
    const { data: custByEmail } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
    console.log('Customers by email:', custByEmail?.map(c => ({ id: c.id, name: c.name, profile: c.profile_id, org_id: c.organization_id })))
    return
  }

  // 3. Get repairs for all customers of this profile
  const customerIds = customers.map(c => c.id)
  
  const { data: repairs, error: repErr } = await supabase
    .from('repairs')
    .select('id, ticket_number, device_brand, device_model, status, customer_id, organization_id, created_at, updated_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })

  console.log('Repairs for these customers:', repairs)
  
  // 4. check what customer the latest repair for this email belongs to?
  const { data: repairsByEmailCust } = await supabase
    .from('repairs')
    .select('id, ticket_number, device_brand, device_model, status, customer_id, organization_id, created_at, customers!inner(email, name, profile_id)')
    .eq('customers.email', email)
    .order('created_at', { ascending: false })
    
  console.log('Repairs for any customer with this email:', repairsByEmailCust)
}

check().catch(console.error)
