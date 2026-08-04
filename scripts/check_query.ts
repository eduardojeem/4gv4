import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: repairs } = await supabase
    .from('repairs')
    .select('id, ticket_number, device_brand, device_model, status, customer_id, organization_id, created_at, updated_at')
    .eq('customer_id', 'b642d5bb-771c-4fb6-8fd4-26beeacaf2cf')
    .eq('organization_id', '62c07291-a593-4add-8232-4b4d2775484b')
    .order('created_at', { ascending: false })
    .limit(50)
  
  console.log('Repairs returned by query format:', repairs?.length, repairs?.map(r => r.ticket_number))
}
check()
