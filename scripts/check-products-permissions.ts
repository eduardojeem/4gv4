
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkProducts() {
  console.log('Checking products table...')
  
  // Try to select
  const { data, error } = await supabase.from('products').select('*').limit(1)
  
  if (error) {
    console.error('Error selecting products:', error)
  } else {
    console.log('Select successful. Rows:', data?.length)
    if (data && data.length > 0) {
      console.log('Sample product:', data[0])
    }
  }

  // Try to insert a test product
  const testProduct = {
    sku: `TEST-${Date.now()}`,
    name: 'Test Product',
    sale_price: 100,
    purchase_price: 50,
    is_active: true,
    has_offer: true,
    offer_price: 90
  }

  console.log('Attempting to insert product:', testProduct)
  const { data: insertData, error: insertError } = await supabase
    .from('products')
    .insert(testProduct)
    .select()
    .single()

  if (insertError) {
    console.error('Error inserting product:', insertError)
  } else {
    console.log('Insert successful:', insertData)
    
    // Clean up
    if (insertData) {
        console.log('Cleaning up...')
        await supabase.from('products').delete().eq('id', insertData.id)
    }
  }
}

checkProducts()
