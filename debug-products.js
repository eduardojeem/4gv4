// Script para verificar productos en la base de datos
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variables de entorno de Supabase no configuradas')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ No configurada')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Configurada' : '❌ No configurada')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProducts() {
  try {
    console.log('🔍 Verificando conexión a Supabase...')
    
    // Verificar conexión básica
    const { data: healthCheck, error: healthError } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (healthError) {
      console.log('❌ Error de conexión:', healthError.message)
      return
    }
    
    console.log('✅ Conexión a Supabase exitosa')
    
    // Contar productos totales
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.log('❌ Error contando productos:', countError.message)
      return
    }
    
    console.log(`📦 Total de productos en la base de datos: ${totalCount}`)
    
    // Contar productos activos
    const { count: activeCount, error: activeError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (activeError) {
      console.log('❌ Error contando productos activos:', activeError.message)
      return
    }
    
    console.log(`✅ Productos activos: ${activeCount}`)
    
    // Obtener algunos productos de muestra
    const { data: sampleProducts, error: sampleError } = await supabase
      .from('products')
      .select('id, name, sku, sale_price, stock_quantity, is_active')
      .limit(5)
    
    if (sampleError) {
      console.log('❌ Error obteniendo productos de muestra:', sampleError.message)
      return
    }
    
    console.log('\n📋 Productos de muestra:')
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${product.sku})`)
      console.log(`   Precio: $${product.sale_price}`)
      console.log(`   Stock: ${product.stock_quantity}`)
      console.log(`   Activo: ${product.is_active ? '✅' : '❌'}`)
      console.log('')
    })
    
    if (totalCount === 0) {
      console.log('⚠️  No hay productos en la base de datos.')
      console.log('💡 Sugerencia: Agrega productos desde /dashboard/products')
    } else if (activeCount === 0) {
      console.log('⚠️  No hay productos activos.')
      console.log('💡 Sugerencia: Activa algunos productos desde /dashboard/products')
    } else {
      console.log('✅ La base de datos tiene productos activos disponibles para el POS')
    }
    
  } catch (error) {
    console.log('❌ Error inesperado:', error.message)
  }
}

checkProducts()