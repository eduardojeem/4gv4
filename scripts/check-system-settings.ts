
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSettings() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .single()

  if (error) {
    console.error('Error fetching settings:', error)
    return
  }

  console.log('System Settings in DB:', JSON.stringify(data, null, 2))
}

checkSettings()
