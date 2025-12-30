import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDatabase() {
  try {
    console.log('Verificando tablas existentes...')
    
    // Intentar consultar las tablas para ver si existen
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['categories', 'products', 'suppliers', 'sales', 'sale_items'])
    
    if (tablesError) {
      console.log('No se pudo verificar tablas existentes, continuando...')
    } else {
      console.log('Tablas existentes:', existingTables?.map(t => t.table_name) || [])
    }
    
    // Crear categorías de prueba
    console.log('Creando categorías de prueba...')
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .upsert([
        {
          id: 'electronics',
          name: 'Electrónicos',
          description: 'Productos electrónicos y tecnológicos'
        },
        {
          id: 'accessories',
          name: 'Accesorios',
          description: 'Accesorios para dispositivos'
        }
      ])
      .select()

    if (categoryError) {
      console.error('Error creando categorías:', categoryError)
      console.log('Esto es normal si las tablas no existen aún.')
    } else {
      console.log('✓ Categorías creadas/actualizadas:', categoryData?.length || 0)
    }

    // Crear productos de prueba
    console.log('Creando productos de prueba...')
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
        category_id: 'electronics',
        is_active: true
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
        category_id: 'electronics',
        is_active: true
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
        category_id: 'accessories',
        is_active: true
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
        category_id: 'accessories',
        is_active: true
      }
    ]

    const { data: productData, error: productError } = await supabase
      .from('products')
      .upsert(testProducts)
      .select()

    if (productError) {
      console.error('Error creando productos:', productError)
      console.log('Esto es normal si las tablas no existen aún.')
      console.log('Por favor, crea las tablas manualmente en Supabase usando el archivo create-tables.sql')
    } else {
      console.log('✓ Productos creados/actualizados:', productData?.length || 0)
    }
    
    console.log('Configuración completada!')
    
  } catch (err) {
    console.error('Error general:', err)
    console.log('\nPor favor, ejecuta manualmente el contenido de create-tables.sql en el editor SQL de Supabase.')
  }
}

setupDatabase()