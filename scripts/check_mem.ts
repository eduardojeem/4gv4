import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: mem } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', '3f2226d0-6abd-4537-9207-9dfb83dcaa1c')
    .eq('organization_id', '62c07291-a593-4add-8232-4b4d2775484b')
  
  console.log('Membership:', mem)
}
check()
