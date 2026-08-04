import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data } = await supabase
    .from('repairs')
    .select('id, ticket_number, branch_id')
    .eq('ticket_number', 'REP-000026')
    .single()
    
  console.log('Repair Branch:', data)
}
check()
