import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: policies } = await supabase.rpc('execute_sql', { sql_query: "SELECT polname, polcmd, polqual, polwithcheck FROM pg_policy WHERE polrelid = 'repairs'::regclass" })
  console.log('Policies:', policies)
}
check()
