
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos service role para escribir

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Mapa de palabras clave a IDs de imágenes de Unsplash
const IMAGE_MAP: Record<string, string> = {
  'iphone': 'photo-1510557880182-3d4d3cba35a5',
  'samsung': 'photo-1610945415295-d9bbf067e59c',
  'galaxy': 'photo-1610945415295-d9bbf067e59c',
  'xiaomi': 'photo-1511707171634-5f897ff02aa9', // Generic phone
  'motorola': 'photo-1598327775666-359659eb96a3', // Generic android
  'celular': 'photo-1511707171634-5f897ff02aa9',
  'smartphone': 'photo-1598327775666-359659eb96a3',
  'auricular': 'photo-1505740420928-5e560c06d30e',
  'audifono': 'photo-1505740420928-5e560c06d30e',
  'headphone': 'photo-1505740420928-5e560c06d30e',
  'parlante': 'photo-1543512214-318c77a799bf',
  'speaker': 'photo-1608043152269-423dbba4e7e1',
  'funda': 'photo-1601593346740-925612772716',
  'case': 'photo-1601593346740-925612772716',
  'cargador': 'photo-1583863788434-e58a36330cf0',
  'cable': 'photo-1583863788434-e58a36330cf0',
  'pantalla': 'photo-1550029402-226113b786cf', // TV/Screen
  'monitor': 'photo-1527443224154-c4a3942d3acf',
  'laptop': 'photo-1496181133206-80ce9b88a853',
  'notebook': 'photo-1496181133206-80ce9b88a853',
  'tablet': 'photo-1544244015-0df4b3ffc6b0',
  'ipad': 'photo-1544244015-0df4b3ffc6b0',
  'reloj': 'photo-1523275335684-37898b6baf30',
  'watch': 'photo-1523275335684-37898b6baf30',
  'smartwatch': 'photo-1579586337278-3befd40fd17a',
  'camara': 'photo-1516035069371-29a1b244cc32',
  'mouse': 'photo-1527864550417-7fd91fc51a46',
  'teclado': 'photo-1587829741301-dc798b91a603',
  'gamer': 'photo-1542751371-adc38448a05e',
  'gaming': 'photo-1542751371-adc38448a05e',
  'memoria': 'photo-1562976540-1502c2145186', // SD card / chip
  'usb': 'photo-1623949556303-b0d17d122294', // USB drive
  'pendrive': 'photo-1623949556303-b0d17d122294',
  'ssd': 'photo-1597872250977-010e42551c51', // SSD/Hard drive
  'disco': 'photo-1597872250977-010e42551c51',
  'vidrio': 'photo-1598327775666-359659eb96a3', // Phone screen
  'glass': 'photo-1598327775666-359659eb96a3',
  'bateria': 'photo-1619445492484-934c264c7848', // Battery
}

const DEFAULT_IMAGE = 'photo-1519389950473-47ba0277781c' // Tech generic

function getUnsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`
}

function getImageForProduct(name: string): string {
  const lowerName = name.toLowerCase()
  
  for (const [keyword, photoId] of Object.entries(IMAGE_MAP)) {
    if (lowerName.includes(keyword)) {
      return getUnsplashUrl(photoId)
    }
  }
  
  return getUnsplashUrl(DEFAULT_IMAGE)
}

async function updateProductImages() {
  console.log('🚀 Iniciando actualización de imágenes de productos...')

  // 1. Obtener productos con imágenes de placeholder O con la imagen por defecto (para mejorarla)
  // Nota: Supabase no soporta OR complejo con LIKE fácilmente en una línea sin query builder avanzado,
  // así que traemos todos los que tengan unsplash o placehold.co y filtramos en memoria o hacemos dos queries.
  // Vamos a traer todos para asegurar que el mapa se aplique bien.
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, image_url')
    
  if (error) {
    console.error('❌ Error al obtener productos:', error)
    return
  }

  console.log(`📦 Encontrados ${products?.length || 0} productos totales`)

  if (!products || products.length === 0) {
    console.log('✅ No hay productos para actualizar.')
    return
  }

  let updatedCount = 0
  let errorsCount = 0
  let skippedCount = 0

  // 2. Actualizar cada producto
  for (const product of products) {
    const newImageUrl = getImageForProduct(product.name)
    
    // Si la imagen actual ya es la correcta (o es una personalizada que no queremos tocar), podríamos saltarla.
    // Pero como estamos "arreglando", vamos a sobrescribir si es placehold.co O si es la DEFAULT antigua y ahora tenemos una mejor.
    
    const isPlaceholder = !product.image_url || product.image_url.includes('placehold.co')
    const isDefault = product.image_url && product.image_url.includes(DEFAULT_IMAGE)
    const isImprovement = newImageUrl !== product.image_url && !newImageUrl.includes(DEFAULT_IMAGE)

    if (isPlaceholder || (isDefault && isImprovement) || (product.image_url && !product.image_url.includes('unsplash') && !product.image_url.startsWith('/'))) {
        console.log(`🔄 Actualizando: ${product.name.substring(0, 30)}...`)
        console.log(`   De: ${product.image_url ? product.image_url.substring(0, 50) : 'null'}...`)
        console.log(`   A:  ${newImageUrl.substring(0, 50)}...`)
        
        const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: newImageUrl })
        .eq('id', product.id)

        if (updateError) {
        console.error(`   ❌ Error actualizando producto ${product.id}:`, updateError.message)
        errorsCount++
        } else {
        updatedCount++
        }
    } else {
        skippedCount++
    }
  }

  console.log('\n📊 RESUMEN FINAL:')
  console.log(`   ✅ Actualizados: ${updatedCount}`)
  console.log(`   ⏭️  Omitidos: ${skippedCount}`)
  console.log(`   ❌ Errores: ${errorsCount}`)
}

updateProductImages().catch(console.error)
