import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: repairs, error: repErr } = await supabase
    .from('repairs')
    .select('*')
    .eq('customer_id', 'b642d5bb-771c-4fb6-8fd4-26beeacaf2cf')
    
  console.log('All repairs for b642d5bb:', repairs?.length, repErr)
}
check()
