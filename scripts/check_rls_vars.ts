import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: rep } = await supabase
    .from('repairs')
    .select('id, ticket_number, customer_id, organization_id')
    .eq('ticket_number', 'REP-000026')
    .single()
    
  const { data: cust } = await supabase
    .from('customers')
    .select('id, organization_id, profile_id')
    .eq('id', rep!.customer_id)
    .single()
    
  console.log('Repair Org:', rep?.organization_id)
  console.log('Customer Org:', cust?.organization_id)
  console.log('Customer Profile ID:', cust?.profile_id)
}
check()
