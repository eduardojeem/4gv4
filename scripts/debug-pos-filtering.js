/**
 * Script de diagnóstico para el filtrado de productos en POS
 * Identifica por qué solo se muestran 21 productos
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../.env.local' })

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no configuradas')
  console.log('Necesitas configurar:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugPOSFiltering() {
  console.log('🔍 DIAGNÓSTICO DE FILTRADO DE PRODUCTOS POS\n')
  
  try {
    // 1. Verificar conexión y autenticación
    console.log('1️⃣ Verificando conexión a Supabase...')
    const { data: { session } } = await supabase.auth.getSession()
    const userRole = session?.user?.user_metadata?.role || session?.user?.app_metadata?.user_role || 'anonymous'
    console.log(`   Usuario: ${session?.user?.email || 'No autenticado'}`)
    console.log(`   Rol: ${userRole}\n`)

    // 2. Conteo total de productos
    console.log('2️⃣ Contando productos totales...')
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('   ❌ Error:', countError.message)
      return
    }
    console.log(`   Total en DB: ${totalCount} productos\n`)

    // 3. Análisis por estado activo/inactivo
    console.log('3️⃣ Analizando productos por estado...')
    const { data: allProducts, error: allError } = await supabase
      .from('products')
      .select('id, name, is_active, stock_quantity, sale_price, category_id')
      .order('name')

    if (allError) {
      console.error('   ❌ Error:', allError.message)
      return
    }

    const activeProducts = allProducts.filter(p => p.is_active)
    const inactiveProducts = allProducts.filter(p => !p.is_active)
    
    console.log(`   Productos activos: ${activeProducts.length}`)
    console.log(`   Productos inactivos: ${inactiveProducts.length}`)
    
    if (inactiveProducts.length > 0) {
      console.log('   📋 Productos inactivos encontrados:')
      inactiveProducts.slice(0, 5).forEach(p => {
        console.log(`      - ${p.name} (ID: ${p.id})`)
      })
      if (inactiveProducts.length > 5) {
        console.log(`      ... y ${inactiveProducts.length - 5} más`)
      }
    }
    console.log()

    // 4. Análisis por stock
    console.log('4️⃣ Analizando productos por stock...')
    const inStock = activeProducts.filter(p => p.stock_quantity > 5)
    const lowStock = activeProducts.filter(p => p.stock_quantity <= 5 && p.stock_quantity > 0)
    const outOfStock = activeProducts.filter(p => p.stock_quantity === 0)
    
    console.log(`   En stock (>5): ${inStock.length}`)
    console.log(`   Stock bajo (1-5): ${lowStock.length}`)
    console.log(`   Sin stock (0): ${outOfStock.length}\n`)

    // 5. Análisis por rango de precios
    console.log('5️⃣ Analizando productos por precio...')
    const prices = activeProducts.map(p => p.sale_price).filter(p => p > 0)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    
    console.log(`   Precio mínimo: ${minPrice}`)
    console.log(`   Precio máximo: ${maxPrice}`)
    
    // Verificar si el filtro por defecto (max: 10000) está limitando
    const pricesAbove10k = activeProducts.filter(p => p.sale_price > 10000)
    if (pricesAbove10k.length > 0) {
      console.log(`   ⚠️  ${pricesAbove10k.length} productos tienen precio > 10,000 (límite por defecto)`)
      console.log('   📋 Productos con precio alto:')
      pricesAbove10k.slice(0, 3).forEach(p => {
        console.log(`      - ${p.name}: ${p.sale_price}`)
      })
    }
    console.log()

    // 6. Análisis por categorías
    console.log('6️⃣ Analizando productos por categoría...')
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')

    if (catError) {
      console.warn('   ⚠️  No se pudieron cargar categorías:', catError.message)
    } else {
      console.log(`   Total categorías: ${categories.length}`)
      
      // Contar productos por categoría
      const categoryStats = {}
      activeProducts.forEach(p => {
        const catId = p.category_id || 'sin_categoria'
        categoryStats[catId] = (categoryStats[catId] || 0) + 1
      })
      
      console.log('   📊 Productos por categoría:')
      Object.entries(categoryStats).forEach(([catId, count]) => {
        const catName = categories.find(c => c.id === catId)?.name || 'Sin categoría'
        console.log(`      - ${catName}: ${count} productos`)
      })
    }
    console.log()

    // 7. Simulación del filtro POS actual
    console.log('7️⃣ Simulando filtros POS por defecto...')
    
    // Filtros por defecto del POS
    const defaultFilters = {
      is_active: true,
      showFeatured: false,
      stockFilter: 'all', // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
      priceRange: { min: 0, max: 10000 },
      selectedCategory: 'all'
    }
    
    let filteredProducts = activeProducts.filter(product => {
      // Filtro de precio por defecto
      const matchesPrice = product.sale_price >= defaultFilters.priceRange.min && 
                          product.sale_price <= defaultFilters.priceRange.max
      
      // Filtro de stock
      let matchesStock = true
      switch (defaultFilters.stockFilter) {
        case 'in_stock':
          matchesStock = product.stock_quantity > 5
          break
        case 'low_stock':
          matchesStock = product.stock_quantity <= 5 && product.stock_quantity > 0
          break
        case 'out_of_stock':
          matchesStock = product.stock_quantity === 0
          break
      }
      
      return matchesPrice && matchesStock
    })
    
    console.log(`   Productos después de filtros por defecto: ${filteredProducts.length}`)
    
    if (filteredProducts.length === 21) {
      console.log('   🎯 ¡ENCONTRADO! El filtro está limitando exactamente a 21 productos')
    }
    
    // 8. Verificar si hay límites en localStorage
    console.log('\n8️⃣ Verificando posibles configuraciones guardadas...')
    console.log('   💡 Revisa en el navegador:')
    console.log('      - localStorage.getItem("pos.prefs")')
    console.log('      - Filtros activos en la interfaz')
    console.log('      - Término de búsqueda activo')
    
    // 9. Recomendaciones
    console.log('\n9️⃣ RECOMENDACIONES:')
    
    if (pricesAbove10k.length > 0) {
      console.log('   🔧 Aumentar el límite de precio por defecto de 10,000 a un valor mayor')
    }
    
    if (inactiveProducts.length > 0) {
      console.log('   🔧 Activar productos inactivos si deben mostrarse en POS')
    }
    
    if (filteredProducts.length < activeProducts.length) {
      const diff = activeProducts.length - filteredProducts.length
      console.log(`   🔧 ${diff} productos están siendo filtrados por los criterios por defecto`)
    }
    
    console.log('   🔧 Verificar filtros activos en la interfaz del POS')
    console.log('   🔧 Limpiar localStorage si hay configuraciones guardadas')
    
    console.log('\n✅ Diagnóstico completado')
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error.message)
  }
}

// Ejecutar diagnóstico
debugPOSFiltering()