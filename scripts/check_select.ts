import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data, error } = await supabase
    .from('repairs')
    .select('id, ticket_number, device_type, device_brand, device_model, problem_description, status, created_at, final_cost, estimated_cost')
    .eq('ticket_number', 'REP-000026')
    .single()
    
  console.log('Result:', data, 'Error:', error)
}
check()
