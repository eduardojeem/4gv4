import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2]
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, anon)

async function main() {
  const { data, error, count } = await supabase
    .from('products')
    .select('id,name,sale_price,stock_quantity,is_active', { count: 'exact' })
    .eq('is_active', true)
    .limit(20)

  console.log('Error:', error?.message || null)
  console.log('Count:', count)
  console.log('Sample:', (data || []).slice(0, 5))
}

main()

