// Script detallado para verificar productos en Supabase
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function detailedProductCheck() {
  try {
    console.log('🔍 Verificación detallada de productos...')
    
    // 1. Verificar estructura de la tabla products
    console.log('\n📋 Verificando estructura de la tabla products...')
    try {
      const { data: sampleData, error: structureError } = await supabase
        .from('products')
        .select('*')
        .limit(1)
      
      if (structureError) {
        console.log('❌ Error obteniendo estructura:', structureError.message)
      } else if (sampleData && sampleData.length > 0) {
        console.log('✅ Columnas disponibles:', Object.keys(sampleData[0]).join(', '))
      } else {
        // Intentar obtener estructura sin datos
        const { error: emptyError } = await supabase
          .from('products')
          .select('*')
          .eq('id', 'non-existent-id')
        
        if (emptyError && emptyError.message.includes('column')) {
          console.log('⚠️  Posible problema de estructura:', emptyError.message)
        } else {
          console.log('✅ Tabla existe pero está vacía')
        }
      }
    } catch (err) {
      console.log('❌ Error verificando estructura:', err.message)
    }
    
    // 2. Contar todos los productos sin filtros
    console.log('\n📊 Contando productos sin filtros...')
    try {
      const { count: totalCount, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.log('❌ Error contando productos:', countError.message)
      } else {
        console.log(`📦 Total de productos (sin filtros): ${totalCount}`)
      }
    } catch (err) {
      console.log('❌ Error en conteo:', err.message)
    }
    
    // 3. Verificar productos activos/inactivos
    console.log('\n🔄 Verificando productos por estado...')
    try {
      const { count: activeCount, error: activeError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      
      const { count: inactiveCount, error: inactiveError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)
      
      console.log(`✅ Productos activos: ${activeCount || 0}`)
      console.log(`⚠️  Productos inactivos: ${inactiveCount || 0}`)
      
      if (activeError) console.log('Error activos:', activeError.message)
      if (inactiveError) console.log('Error inactivos:', inactiveError.message)
    } catch (err) {
      console.log('❌ Error verificando estados:', err.message)
    }
    
    // 4. Intentar obtener productos sin filtro is_active
    console.log('\n📋 Obteniendo muestra de productos (todos los estados)...')
    try {
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('id, name, sku, sale_price, stock_quantity, is_active')
        .limit(10)
      
      if (allError) {
        console.log('❌ Error obteniendo productos:', allError.message)
      } else if (allProducts && allProducts.length > 0) {
        console.log(`✅ Encontrados ${allProducts.length} productos:`)
        allProducts.forEach((product, index) => {
          console.log(`${index + 1}. ${product.name || 'Sin nombre'} (${product.sku || 'Sin SKU'})`)
          console.log(`   ID: ${product.id}`)
          console.log(`   Precio: ${product.sale_price || 0}`)
          console.log(`   Stock: ${product.stock_quantity || 0}`)
          console.log(`   Activo: ${product.is_active ? '✅' : '❌'}`)
          console.log('')
        })
      } else {
        console.log('⚠️  No se encontraron productos')
      }
    } catch (err) {
      console.log('❌ Error obteniendo muestra:', err.message)
    }
    
    // 5. Verificar políticas RLS
    console.log('\n🔐 Verificando políticas de seguridad...')
    try {
      // Intentar con diferentes contextos
      const queries = [
        { name: 'Sin autenticación', query: supabase.from('products').select('count') },
        { name: 'Con límite', query: supabase.from('products').select('*').limit(1) }
      ]
      
      for (const { name, query } of queries) {
        try {
          const { data, error } = await query
          console.log(`${name}: ${error ? '❌ ' + error.message : '✅ Funciona'}`)
        } catch (err) {
          console.log(`${name}: ❌ ${err.message}`)
        }
      }
    } catch (err) {
      console.log('❌ Error verificando RLS:', err.message)
    }
    
    // 6. Verificar la consulta exacta que usa el hook
    console.log('\n🎯 Probando consulta exacta del hook usePOSProducts...')
    try {
      const { data: hookData, error: hookError } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .order('name')
      
      if (hookError) {
        console.log('❌ Error en consulta del hook:', hookError.message)
        console.log('💡 Detalles del error:', hookError)
      } else {
        console.log(`✅ Consulta del hook exitosa: ${hookData?.length || 0} productos`)
        if (hookData && hookData.length > 0) {
          console.log('📋 Primeros productos encontrados por el hook:')
          hookData.slice(0, 3).forEach((product, index) => {
            console.log(`${index + 1}. ${product.name} - Stock: ${product.stock_quantity}`)
          })
        }
      }
    } catch (err) {
      console.log('❌ Error en consulta del hook:', err.message)
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

detailedProductCheck()