import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: custs } = await supabase
    .from('customers')
    .select('id, profile_id, organization_id')
    .eq('profile_id', '3f2226d0-6abd-4537-9207-9dfb83dcaa1c')
    
  console.log('Customers for Nelson:', custs)
}
check()
