
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllImages() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, image_url')
  
  if (error) {
    console.error(error)
    return
  }

  console.log(`Total products: ${products.length}`)
  
  const noImage = products.filter(p => !p.image_url)
  console.log(`No image: ${noImage.length}`)
  
  const withImage = products.filter(p => p.image_url)
  console.log(`With image: ${withImage.length}`)
  
  // Group by domain/type
  const domains: Record<string, number> = {}
  withImage.forEach(p => {
    const url = p.image_url
    let domain = 'other'
    if (url.startsWith('http')) {
      try {
        domain = new URL(url).hostname
      } catch (e) {
        domain = 'invalid-url'
      }
    } else if (url.startsWith('/')) {
      domain = 'local-path'
    } else {
      domain = 'relative-path'
    }
    domains[domain] = (domains[domain] || 0) + 1
  })
  
  console.log('Image domains:', domains)

  // Show some examples of local paths if any
  if (domains['local-path'] > 0) {
    console.log('Example local paths:', withImage.filter(p => p.image_url.startsWith('/')).slice(0, 5).map(p => p.image_url))
  }
}

checkAllImages()
