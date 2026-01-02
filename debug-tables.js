// Script para verificar las tablas disponibles en Supabase
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  try {
    console.log('🔍 Verificando tablas disponibles en Supabase...')
    
    // Intentar acceder a diferentes tablas comunes
    const tablesToCheck = [
      'products', 
      'product', 
      'items', 
      'inventory', 
      'categories',
      'sales',
      'customers'
    ]
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .limit(1)
        
        if (error) {
          console.log(`❌ Tabla '${tableName}': ${error.message}`)
        } else {
          console.log(`✅ Tabla '${tableName}': ${count} registros`)
          
          // Si encontramos registros, mostrar estructura
          if (count > 0) {
            const { data: sample } = await supabase
              .from(tableName)
              .select('*')
              .limit(1)
            
            if (sample && sample.length > 0) {
              console.log(`   Columnas: ${Object.keys(sample[0]).join(', ')}`)
            }
          }
        }
      } catch (err) {
        console.log(`❌ Error accediendo a tabla '${tableName}': ${err.message}`)
      }
    }
    
    // Intentar obtener información del esquema usando RPC si está disponible
    try {
      console.log('\n🔍 Intentando obtener información del esquema...')
      const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_schema_info')
      
      if (schemaError) {
        console.log('⚠️  No se pudo obtener información del esquema:', schemaError.message)
      } else {
        console.log('📋 Información del esquema:', schemaInfo)
      }
    } catch (err) {
      console.log('⚠️  RPC get_schema_info no disponible')
    }
    
    // Verificar permisos específicos en la tabla products
    console.log('\n🔐 Verificando permisos en tabla products...')
    
    try {
      // Intentar SELECT
      const { error: selectError } = await supabase
        .from('products')
        .select('id')
        .limit(1)
      
      console.log(`SELECT: ${selectError ? '❌ ' + selectError.message : '✅ Permitido'}`)
      
      // Intentar INSERT (sin ejecutar realmente)
      const { error: insertError } = await supabase
        .from('products')
        .insert({ name: 'test' }, { dryRun: true })
      
      console.log(`INSERT: ${insertError ? '❌ ' + insertError.message : '✅ Permitido'}`)
      
    } catch (err) {
      console.log('❌ Error verificando permisos:', err.message)
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

checkTables()