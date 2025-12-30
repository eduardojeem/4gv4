import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Productos de prueba
const testProducts = [
  {
    id: '1',
    name: 'Smartphone Samsung Galaxy A54',
    description: 'Smartphone con cámara de 50MP y pantalla Super AMOLED',
    sku: 'SAM-A54-128',
    barcode: '7891234567890',
    sale_price: 2500000,
    stock_quantity: 15,
    unit_measure: 'unidad',
    is_active: true,
    image_url: null
  },
  {
    id: '2',
    name: 'Auriculares Bluetooth Sony',
    description: 'Auriculares inalámbricos con cancelación de ruido',
    sku: 'SONY-WH1000',
    barcode: '7891234567891',
    sale_price: 850000,
    stock_quantity: 8,
    unit_measure: 'unidad',
    is_active: true,
    image_url: null
  },
  {
    id: '11',
    name: 'Teclado Mecánico Logitech',
    description: 'Teclado gaming con switches mecánicos',
    sku: 'LOG-MX-KEYS',
    barcode: '7891234567899',
    sale_price: 450000,
    stock_quantity: 12,
    unit_measure: 'unidad',
    is_active: true,
    image_url: null
  },
  {
    id: '12',
    name: 'Mouse Gaming Razer',
    description: 'Mouse óptico para gaming con RGB',
    sku: 'RAZ-DEATHADDER',
    barcode: '7891234567900',
    sale_price: 280000,
    stock_quantity: 20,
    unit_measure: 'unidad',
    is_active: true,
    image_url: null
  }
]

async function seedProducts() {
  try {
    console.log('Iniciando inserción de productos de prueba...')
    
    // Primero crear una categoría por defecto
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .upsert([
        {
          id: 'electronics',
          name: 'Electrónicos',
          description: 'Productos electrónicos y tecnológicos'
        }
      ])
      .select()

    if (categoryError) {
      console.error('Error creando categoría:', categoryError)
    } else {
      console.log('Categoría creada/actualizada:', categoryData)
    }

    // Insertar productos
    const { data, error } = await supabase
      .from('products')
      .upsert(testProducts.map(product => ({
        ...product,
        category_id: 'electronics'
      })))
      .select()

    if (error) {
      console.error('Error insertando productos:', error)
    } else {
      console.log('Productos insertados exitosamente:', data?.length)
      console.log('Productos:', data)
    }

  } catch (err) {
    console.error('Error general:', err)
  }
}

seedProducts()