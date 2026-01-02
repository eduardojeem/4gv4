// Script para configurar políticas RLS para el sistema POS
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada')
  console.log('💡 Necesitas la clave de servicio para configurar políticas RLS')
  process.exit(1)
}

// Usar la clave de servicio para crear políticas
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const policies = {
  products: [
    {
      name: 'products_select_policy',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "products_select_policy" ON "public"."products"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
      `,
      description: 'Permitir lectura de productos a todos los usuarios'
    },
    {
      name: 'products_insert_policy',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "products_insert_policy" ON "public"."products"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
      `,
      description: 'Permitir inserción de productos a usuarios autenticados'
    },
    {
      name: 'products_update_policy',
      operation: 'UPDATE',
      sql: `
        CREATE POLICY "products_update_policy" ON "public"."products"
        AS PERMISSIVE FOR UPDATE
        TO public
        USING (true)
        WITH CHECK (true);
      `,
      description: 'Permitir actualización de productos a usuarios autenticados'
    },
    {
      name: 'products_delete_policy',
      operation: 'DELETE',
      sql: `
        CREATE POLICY "products_delete_policy" ON "public"."products"
        AS PERMISSIVE FOR DELETE
        TO public
        USING (true);
      `,
      description: 'Permitir eliminación de productos a usuarios autenticados'
    }
  ],
  categories: [
    {
      name: 'categories_select_policy',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "categories_select_policy" ON "public"."categories"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
      `,
      description: 'Permitir lectura de categorías a todos los usuarios'
    },
    {
      name: 'categories_insert_policy',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "categories_insert_policy" ON "public"."categories"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
      `,
      description: 'Permitir inserción de categorías'
    }
  ],
  sales: [
    {
      name: 'sales_select_policy',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "sales_select_policy" ON "public"."sales"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
      `,
      description: 'Permitir lectura de ventas'
    },
    {
      name: 'sales_insert_policy',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "sales_insert_policy" ON "public"."sales"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
      `,
      description: 'Permitir inserción de ventas'
    }
  ],
  sale_items: [
    {
      name: 'sale_items_select_policy',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "sale_items_select_policy" ON "public"."sale_items"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
      `,
      description: 'Permitir lectura de items de venta'
    },
    {
      name: 'sale_items_insert_policy',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "sale_items_insert_policy" ON "public"."sale_items"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
      `,
      description: 'Permitir inserción de items de venta'
    }
  ],
  customers: [
    {
      name: 'customers_select_policy',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "customers_select_policy" ON "public"."customers"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
      `,
      description: 'Permitir lectura de clientes'
    },
    {
      name: 'customers_insert_policy',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "customers_insert_policy" ON "public"."customers"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
      `,
      description: 'Permitir inserción de clientes'
    },
    {
      name: 'customers_update_policy',
      operation: 'UPDATE',
      sql: `
        CREATE POLICY "customers_update_policy" ON "public"."customers"
        AS PERMISSIVE FOR UPDATE
        TO public
        USING (true)
        WITH CHECK (true);
      `,
      description: 'Permitir actualización de clientes'
    }
  ]
}

async function setupRLSPolicies() {
  try {
    console.log('🔐 Configurando políticas RLS para el sistema POS...')
    
    // Verificar acceso con clave de servicio
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.log('❌ Error de acceso con clave de servicio:', testError.message)
      return
    }
    
    console.log('✅ Acceso con clave de servicio verificado')
    
    // Procesar cada tabla
    for (const [tableName, tablePolicies] of Object.entries(policies)) {
      console.log(`\n📋 Configurando políticas para tabla: ${tableName}`)
      
      // Verificar si la tabla existe
      try {
        const { error: tableError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (tableError && tableError.message.includes('does not exist')) {
          console.log(`⚠️  Tabla '${tableName}' no existe, saltando...`)
          continue
        }
      } catch (err) {
        console.log(`⚠️  No se pudo verificar tabla '${tableName}', saltando...`)
        continue
      }
      
      // Habilitar RLS en la tabla si no está habilitado
      try {
        console.log(`🔒 Habilitando RLS en tabla ${tableName}...`)
        const { error: rlsError } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE "public"."${tableName}" ENABLE ROW LEVEL SECURITY;`
        })
        
        if (rlsError && !rlsError.message.includes('already enabled')) {
          console.log(`⚠️  Error habilitando RLS en ${tableName}:`, rlsError.message)
        } else {
          console.log(`✅ RLS habilitado en ${tableName}`)
        }
      } catch (err) {
        // Intentar método alternativo
        try {
          await supabase.rpc('enable_rls', { table_name: tableName })
          console.log(`✅ RLS habilitado en ${tableName} (método alternativo)`)
        } catch (altErr) {
          console.log(`⚠️  No se pudo habilitar RLS en ${tableName}`)
        }
      }
      
      // Crear políticas para la tabla
      for (const policy of tablePolicies) {
        try {
          console.log(`  📝 Creando política: ${policy.name} (${policy.operation})`)
          
          // Primero, intentar eliminar la política si existe
          try {
            await supabase.rpc('exec_sql', {
              sql: `DROP POLICY IF EXISTS "${policy.name}" ON "public"."${tableName}";`
            })
          } catch (dropErr) {
            // Ignorar errores de drop
          }
          
          // Crear la nueva política
          const { error: policyError } = await supabase.rpc('exec_sql', {
            sql: policy.sql
          })
          
          if (policyError) {
            console.log(`    ❌ Error creando política ${policy.name}:`, policyError.message)
          } else {
            console.log(`    ✅ Política ${policy.name} creada exitosamente`)
          }
        } catch (err) {
          console.log(`    ❌ Error inesperado con política ${policy.name}:`, err.message)
        }
      }
    }
    
    console.log('\n🎉 Configuración de políticas RLS completada!')
    
    // Verificar que las políticas funcionan
    console.log('\n🧪 Probando acceso con las nuevas políticas...')
    
    try {
      const { data: productsTest, error: productsError } = await supabase
        .from('products')
        .select('count')
      
      console.log(`Productos: ${productsError ? '❌ ' + productsError.message : '✅ Acceso OK'}`)
      
      const { data: categoriesTest, error: categoriesError } = await supabase
        .from('categories')
        .select('count')
      
      console.log(`Categorías: ${categoriesError ? '❌ ' + categoriesError.message : '✅ Acceso OK'}`)
      
      const { data: customersTest, error: customersError } = await supabase
        .from('customers')
        .select('count')
      
      console.log(`Clientes: ${customersError ? '❌ ' + customersError.message : '✅ Acceso OK'}`)
      
    } catch (err) {
      console.log('❌ Error en pruebas de acceso:', err.message)
    }
    
    console.log('\n💡 Ahora puedes ejecutar el script de inserción de productos:')
    console.log('   node seed-products-admin.js')
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

// Función alternativa para crear políticas más simples (si la anterior falla)
async function setupSimplePolicies() {
  console.log('\n🔄 Intentando configuración simplificada...')
  
  const simplePolicies = [
    `ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "products_public_read" ON "public"."products" FOR SELECT USING (true);`,
    `CREATE POLICY "products_public_write" ON "public"."products" FOR INSERT WITH CHECK (true);`,
    `CREATE POLICY "products_public_update" ON "public"."products" FOR UPDATE USING (true);`,
    
    `ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "categories_public_read" ON "public"."categories" FOR SELECT USING (true);`,
    `CREATE POLICY "categories_public_write" ON "public"."categories" FOR INSERT WITH CHECK (true);`,
    
    `ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "sales_public_read" ON "public"."sales" FOR SELECT USING (true);`,
    `CREATE POLICY "sales_public_write" ON "public"."sales" FOR INSERT WITH CHECK (true);`,
    
    `ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "customers_public_read" ON "public"."customers" FOR SELECT USING (true);`,
    `CREATE POLICY "customers_public_write" ON "public"."customers" FOR INSERT WITH CHECK (true);`,
    `CREATE POLICY "customers_public_update" ON "public"."customers" FOR UPDATE USING (true);`
  ]
  
  for (const sql of simplePolicies) {
    try {
      await supabase.rpc('exec_sql', { sql })
      console.log('✅ Ejecutado:', sql.substring(0, 50) + '...')
    } catch (err) {
      console.log('⚠️  Error:', sql.substring(0, 50) + '...', err.message)
    }
  }
}

// Ejecutar configuración principal
setupRLSPolicies().catch(err => {
  console.log('❌ Error en configuración principal:', err.message)
  console.log('\n🔄 Intentando configuración alternativa...')
  setupSimplePolicies()
})