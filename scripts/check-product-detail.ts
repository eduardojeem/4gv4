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
  // Pick one product
  const { data: list } = await supabase
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)
  const id = list?.[0]?.id
  if (!id) {
    console.log('No active product found')
    return
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, category:categories(id, name), supplier:suppliers(id, name)')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  console.log('Error:', error?.message || null)
  console.log('Data:', data)
}

main()

