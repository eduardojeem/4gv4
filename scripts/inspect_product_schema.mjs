import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })
}
loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function inspectSchema() {
  // Check products table columns by querying an existing product from another org (e.g. JuanBarber)
  const { data: prods, error } = await supabase.from('products').select('*').limit(1)
  if (prods && prods.length > 0) {
    console.log('Sample product columns:', Object.keys(prods[0]))
    console.log('Sample product:', prods[0])
  } else {
    console.log('No products found or error:', error)
  }

  // Check product_branch_stock or inventory
  const { data: stock, error: stockErr } = await supabase.from('product_branch_stock').select('*').limit(1)
  console.log('product_branch_stock sample:', stock)
}

inspectSchema().catch(console.error)
