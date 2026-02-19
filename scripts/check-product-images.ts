#!/usr/bin/env tsx
/**
 * Script para diagnosticar problemas con imágenes de productos
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProductImages() {
  console.log('🔍 Verificando imágenes de productos...\n')

  // Obtener productos activos
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, image_url, images, is_active')
    .eq('is_active', true)
    .limit(10)

  if (error) {
    console.error('❌ Error al obtener productos:', error.message)
    return
  }

  if (!products || products.length === 0) {
    console.log('⚠️  No se encontraron productos activos')
    return
  }

  console.log(`📦 Encontrados ${products.length} productos activos\n`)

  let withImages = 0
  let withoutImages = 0
  let withMultipleImages = 0

  for (const product of products) {
    console.log(`\n📦 ${product.name} (${product.sku})`)
    console.log(`   ID: ${product.id}`)
    
    if (product.image_url) {
      console.log(`   ✅ image_url: ${product.image_url}`)
      withImages++
      
      // Verificar si es URL de Supabase Storage
      if (product.image_url.includes('supabase')) {
        console.log(`   📁 Tipo: Supabase Storage`)
        
        // Intentar obtener URL pública
        try {
          const path = product.image_url.split('/').pop()
          if (path) {
            const { data } = supabase.storage
              .from('product-images')
              .getPublicUrl(path)
            console.log(`   🔗 URL pública: ${data.publicUrl}`)
          }
        } catch (err) {
          console.log(`   ⚠️  Error al obtener URL pública`)
        }
      } else if (product.image_url.startsWith('http')) {
        console.log(`   🌐 Tipo: URL externa`)
      } else if (product.image_url.startsWith('/')) {
        console.log(`   📄 Tipo: Archivo público`)
      } else {
        console.log(`   ❓ Tipo: Ruta relativa`)
      }
    } else {
      console.log(`   ❌ Sin image_url`)
      withoutImages++
    }

    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      console.log(`   📸 images array: ${product.images.length} imágenes`)
      product.images.forEach((img, idx) => {
        console.log(`      ${idx + 1}. ${img}`)
      })
      withMultipleImages++
    }
  }

  console.log('\n\n📊 RESUMEN:')
  console.log(`   ✅ Con imagen: ${withImages}`)
  console.log(`   ❌ Sin imagen: ${withoutImages}`)
  console.log(`   📸 Con múltiples imágenes: ${withMultipleImages}`)

  // Verificar bucket de storage
  console.log('\n\n🗄️  Verificando bucket de storage...')
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.log(`   ⚠️  No se pudo listar buckets (puede ser por RLS): ${bucketsError.message}`)
    } else if (buckets) {
      const productImagesBucket = buckets.find(b => b.name === 'product-images')
      if (productImagesBucket) {
        console.log(`   ✅ Bucket 'product-images' existe`)
        console.log(`   📁 Público: ${productImagesBucket.public ? 'Sí' : 'No'}`)
      } else {
        console.log(`   ❌ Bucket 'product-images' NO existe`)
      }
    }
  } catch (err) {
    console.log(`   ⚠️  Error al verificar buckets`)
  }

  // Intentar listar archivos en el bucket
  console.log('\n\n📁 Intentando listar archivos en product-images...')
  try {
    const { data: files, error: filesError } = await supabase.storage
      .from('product-images')
      .list('', { limit: 5 })
    
    if (filesError) {
      console.log(`   ⚠️  Error: ${filesError.message}`)
    } else if (files && files.length > 0) {
      console.log(`   ✅ Encontrados ${files.length} archivos (mostrando primeros 5):`)
      files.forEach(file => {
        console.log(`      - ${file.name}`)
      })
    } else {
      console.log(`   ⚠️  No se encontraron archivos`)
    }
  } catch (err) {
    console.log(`   ⚠️  Error al listar archivos`)
  }
}

checkProductImages().catch(console.error)
