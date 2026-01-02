// Script para agregar productos usando la clave de servicio (admin)
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada')
  process.exit(1)
}

// Usar la clave de servicio para bypasear RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const sampleProducts = [
  {
    name: 'Smartphone Samsung Galaxy A54',
    description: 'Smartphone con cámara de 50MP y pantalla Super AMOLED de 6.4 pulgadas',
    sku: 'SAM-A54-128',
    barcode: '7891234567890',
    sale_price: 2500000,
    wholesale_price: 2200000,
    stock_quantity: 15,
    min_stock_level: 5,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['📱']
  },
  {
    name: 'Auriculares Bluetooth Sony WH-1000XM4',
    description: 'Auriculares inalámbricos con cancelación de ruido activa',
    sku: 'SONY-WH1000XM4',
    barcode: '7891234567891',
    sale_price: 850000,
    wholesale_price: 750000,
    stock_quantity: 8,
    min_stock_level: 3,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['🎧']
  },
  {
    name: 'Cargador USB-C 25W Samsung',
    description: 'Cargador rápido original Samsung con cable USB-C',
    sku: 'SAM-CHARGER-25W',
    barcode: '7891234567892',
    sale_price: 120000,
    wholesale_price: 100000,
    stock_quantity: 25,
    min_stock_level: 10,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: false,
    images: ['🔌']
  },
  {
    name: 'Funda Protectora iPhone 14',
    description: 'Funda de silicona transparente para iPhone 14',
    sku: 'CASE-IP14-CLEAR',
    barcode: '7891234567893',
    sale_price: 45000,
    wholesale_price: 35000,
    stock_quantity: 50,
    min_stock_level: 20,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: false,
    images: ['📱']
  },
  {
    name: 'Teclado Mecánico Logitech MX Keys',
    description: 'Teclado inalámbrico para productividad con retroiluminación',
    sku: 'LOG-MX-KEYS',
    barcode: '7891234567894',
    sale_price: 450000,
    wholesale_price: 400000,
    stock_quantity: 12,
    min_stock_level: 5,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['⌨️']
  }
]

async function seedProductsAdmin() {
  try {
    console.log('🔑 Usando clave de servicio para insertar productos...')
    
    // Verificar que podemos acceder con permisos de admin
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.log('❌ Error de acceso con clave de servicio:', testError.message)
      return
    }
    
    console.log('✅ Acceso con clave de servicio exitoso')
    
    // Insertar productos uno por uno
    let insertedCount = 0
    for (const product of sampleProducts) {
      try {
        console.log(`📦 Insertando: ${product.name}...`)
        
        const { data, error } = await supabase
          .from('products')
          .upsert(product, { onConflict: 'sku' })
          .select()
        
        if (error) {
          console.log(`❌ Error insertando ${product.name}:`, error.message)
        } else {
          console.log(`✅ Insertado: ${product.name}`)
          insertedCount++
        }
      } catch (err) {
        console.log(`❌ Error inesperado con ${product.name}:`, err.message)
      }
    }
    
    console.log(`\n🎉 Proceso completado!`)
    console.log(`📦 Productos insertados: ${insertedCount}/${sampleProducts.length}`)
    
    // Verificar el resultado
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    console.log(`✅ Total de productos activos en la base de datos: ${count}`)
    
    if (count > 0) {
      console.log('\n🚀 ¡Perfecto! Ahora el POS debería mostrar productos.')
      console.log('💡 Recarga la página del POS para ver los productos.')
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

seedProductsAdmin()