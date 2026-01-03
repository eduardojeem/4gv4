
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

// Explicitly use Anon Key
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRLS() {
  console.log('Checking RLS visibility with ANON KEY...')

  const { data, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error querying customers:', error.message)
  } else {
    console.log(`Visible customers with ANON KEY: ${count}`)
  }
}

checkRLS()
