// Script para agregar productos de muestra a la base de datos
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const sampleProducts = [
  {
    name: 'Smartphone Samsung Galaxy A54',
    description: 'Smartphone con cámara de 50MP y pantalla Super AMOLED de 6.4 pulgadas',
    sku: 'SAM-A54-128',
    barcode: '7891234567890',
    sale_price: 2500000,
    cost_price: 2000000,
    wholesale_price: 2200000,
    stock_quantity: 15,
    min_stock_level: 5,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['📱'],
    category_id: null // Se asignará después de crear categorías
  },
  {
    name: 'Auriculares Bluetooth Sony WH-1000XM4',
    description: 'Auriculares inalámbricos con cancelación de ruido activa',
    sku: 'SONY-WH1000XM4',
    barcode: '7891234567891',
    sale_price: 850000,
    cost_price: 650000,
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
    cost_price: 80000,
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
    cost_price: 25000,
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
    cost_price: 350000,
    wholesale_price: 400000,
    stock_quantity: 12,
    min_stock_level: 5,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['⌨️']
  },
  {
    name: 'Mouse Gaming Razer DeathAdder V3',
    description: 'Mouse óptico para gaming con sensor de 30,000 DPI',
    sku: 'RAZ-DEATHADDER-V3',
    barcode: '7891234567895',
    sale_price: 280000,
    cost_price: 200000,
    wholesale_price: 240000,
    stock_quantity: 20,
    min_stock_level: 8,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: false,
    images: ['🖱️']
  },
  {
    name: 'Tablet Samsung Galaxy Tab A8',
    description: 'Tablet Android de 10.5 pulgadas con 4GB RAM y 64GB almacenamiento',
    sku: 'SAM-TAB-A8-64',
    barcode: '7891234567896',
    sale_price: 1200000,
    cost_price: 950000,
    wholesale_price: 1100000,
    stock_quantity: 6,
    min_stock_level: 2,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: true,
    images: ['📱']
  },
  {
    name: 'Cable HDMI 2.1 Ultra HD 4K',
    description: 'Cable HDMI de alta velocidad para resolución 4K@120Hz',
    sku: 'HDMI-21-2M',
    barcode: '7891234567897',
    sale_price: 85000,
    cost_price: 50000,
    wholesale_price: 70000,
    stock_quantity: 30,
    min_stock_level: 15,
    unit_measure: 'unidad',
    is_active: true,
    is_featured: false,
    images: ['🔌']
  }
]

async function seedProducts() {
  try {
    console.log('🌱 Iniciando inserción de productos de muestra...')
    
    // Primero, crear algunas categorías
    console.log('📂 Creando categorías...')
    const categories = [
      { name: 'Smartphones', description: 'Teléfonos inteligentes y accesorios' },
      { name: 'Audio', description: 'Auriculares, parlantes y equipos de audio' },
      { name: 'Accesorios', description: 'Cables, cargadores, fundas y otros accesorios' },
      { name: 'Computación', description: 'Teclados, mouse, tablets y equipos de computación' }
    ]
    
    const { data: createdCategories, error: categoryError } = await supabase
      .from('categories')
      .upsert(categories, { onConflict: 'name' })
      .select()
    
    if (categoryError) {
      console.log('⚠️  Error creando categorías (puede que ya existan):', categoryError.message)
    } else {
      console.log(`✅ Categorías creadas: ${createdCategories?.length || 0}`)
    }
    
    // Obtener categorías existentes
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name')
    
    const categoryMap = {}
    if (existingCategories) {
      existingCategories.forEach(cat => {
        categoryMap[cat.name] = cat.id
      })
    }
    
    // Asignar categorías a productos
    const productsWithCategories = sampleProducts.map(product => {
      let categoryId = null
      
      if (product.name.includes('Samsung Galaxy A54') || product.name.includes('iPhone') || product.name.includes('Tablet')) {
        categoryId = categoryMap['Smartphones']
      } else if (product.name.includes('Auriculares')) {
        categoryId = categoryMap['Audio']
      } else if (product.name.includes('Teclado') || product.name.includes('Mouse')) {
        categoryId = categoryMap['Computación']
      } else {
        categoryId = categoryMap['Accesorios']
      }
      
      return {
        ...product,
        category_id: categoryId
      }
    })
    
    console.log('📦 Insertando productos...')
    
    // Insertar productos uno por uno para mejor control de errores
    let insertedCount = 0
    for (const product of productsWithCategories) {
      try {
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

seedProducts()