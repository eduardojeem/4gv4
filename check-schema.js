// Script para verificar la estructura exacta de la tabla products
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    console.log('🔍 Verificando estructura de la tabla products...')
    
    // Intentar insertar un registro vacío para ver qué columnas requiere
    try {
      const { error } = await supabase
        .from('products')
        .insert({})
      
      if (error) {
        console.log('📋 Error de inserción (nos ayuda a ver la estructura):')
        console.log(error.message)
      }
    } catch (err) {
      console.log('Error en inserción de prueba:', err.message)
    }
    
    // Intentar obtener información de las columnas usando una consulta que falle
    try {
      const { error } = await supabase
        .from('products')
        .select('nonexistent_column')
      
      if (error && error.message.includes('column')) {
        console.log('\n📋 Información de columnas desde error:')
        console.log(error.message)
      }
    } catch (err) {
      console.log('Error en consulta de columna:', err.message)
    }
    
    // Intentar crear un producto simple para ver qué funciona
    console.log('\n🧪 Probando inserción con campos básicos...')
    
    const basicProduct = {
      name: 'Producto de Prueba',
      sku: 'TEST-001',
      sale_price: 100000,
      stock_quantity: 10,
      is_active: true
    }
    
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(basicProduct)
        .select()
      
      if (error) {
        console.log('❌ Error con campos básicos:', error.message)
        
        // Intentar con menos campos
        const minimalProduct = {
          name: 'Producto Minimal',
          sku: 'TEST-002'
        }
        
        const { data: minData, error: minError } = await supabase
          .from('products')
          .insert(minimalProduct)
          .select()
        
        if (minError) {
          console.log('❌ Error con campos mínimos:', minError.message)
        } else {
          console.log('✅ Inserción exitosa con campos mínimos')
          console.log('📋 Estructura del producto creado:', minData[0])
          
          // Limpiar el producto de prueba
          await supabase.from('products').delete().eq('sku', 'TEST-002')
        }
      } else {
        console.log('✅ Inserción exitosa con campos básicos')
        console.log('📋 Estructura del producto creado:', data[0])
        
        // Limpiar el producto de prueba
        await supabase.from('products').delete().eq('sku', 'TEST-001')
      }
    } catch (err) {
      console.log('❌ Error en inserción de prueba:', err.message)
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

checkSchema()