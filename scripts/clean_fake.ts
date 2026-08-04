import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { error } = await supabase
    .from('repairs')
    .delete()
    .in('ticket_number', ['REP-013208', 'REP-448372-1', 'REP-448372-2', 'REP-448372-3'])
    .eq('customer_id', 'b642d5bb-771c-4fb6-8fd4-26beeacaf2cf')
  
  console.log('Delete test data result:', error ? error.message : 'success')
}
check()
