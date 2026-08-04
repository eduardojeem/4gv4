import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: cust } = await supabase
    .from('customers')
    .select('id, email, profile_id')
    .eq('id', 'b642d5bb-771c-4fb6-8fd4-26beeacaf2cf')
    .single()
  
  console.log('Customer:', cust)
}
check()
