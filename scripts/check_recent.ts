import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: repairs, error } = await supabase
    .from('repairs')
    .select('id, ticket_number, customer_id, created_at, status')
    .eq('organization_id', '62c07291-a593-4add-8232-4b4d2775484b')
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('Recent repairs:', JSON.stringify(repairs, null, 2), 'Error:', error)
}
check()
