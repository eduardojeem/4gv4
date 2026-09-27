#!/usr/bin/env tsx
/**
 * Script de Verificación de Supabase
 * 
 * Verifica la conexión y el estado de las tablas en Supabase
 * 
 * Uso:
 *   npx tsx scripts/verify-supabase.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar variables de entorno desde .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          process.env[key.trim()] = value
        }
      }
    })
  } catch (err) {
    console.error('Error al cargar .env.local:', err)
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║     🔍 Verificación de Conexión a Supabase                ║')
console.log('╚════════════════════════════════════════════════════════════╝')
console.log('')

// Verificar credenciales
if (!supabaseUrl || !supabaseKey) {
  console.log('❌ ERROR: Credenciales de Supabase no encontradas')
  console.log('')
  console.log('Asegúrate de tener estas variables en .env.local:')
  console.log('  - NEXT_PUBLIC_SUPABASE_URL')
  console.log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.log('')
  process.exit(1)
}

if (supabaseUrl === 'your_supabase_project_url') {
  console.log('❌ ERROR: URL de Supabase no configurada')
  console.log('')
  console.log('Reemplaza "your_supabase_project_url" con tu URL real')
  console.log('')
  process.exit(1)
}

console.log('✅ Credenciales encontradas')
console.log(`   URL: ${supabaseUrl}`)
console.log(`   Key: ${supabaseKey.substring(0, 20)}...`)
console.log('')

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyConnection() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Verificando Tablas')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  const tables = [
    { name: 'products', label: 'Productos' },
    { name: 'categories', label: 'Categorías' },
    { name: 'suppliers', label: 'Proveedores' },
    { name: 'product_movements', label: 'Movimientos de Productos' },
    { name: 'product_alerts', label: 'Alertas de Productos' },
    { name: 'product_price_history', label: 'Historial de Precios' },
    { name: 'customers', label: 'Clientes' },
    { name: 'repairs', label: 'Reparaciones' },
    { name: 'profiles', label: 'Perfiles (Técnicos)' },
    { name: 'repair_images', label: 'Imágenes de Reparaciones' }
  ]

  let allTablesExist = true
  const tableStats: Array<{ table: string; count: number }> = []

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ ${table.label} (${table.name})`)
        console.log(`   Error: ${error.message}`)
        allTablesExist = false
      } else {
        console.log(`✅ ${table.label} (${table.name})`)
        console.log(`   Registros: ${count || 0}`)
        tableStats.push({ table: table.name, count: count || 0 })
      }
    } catch (err) {
      console.log(`❌ ${table.label} (${table.name})`)
      console.log(`   Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      allTablesExist = false
    }
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📈 Resumen')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  if (allTablesExist) {
    console.log('✅ Todas las tablas existen y son accesibles')
    console.log('')
    
    if (tableStats.length > 0) {
      console.log('📊 Estadísticas:')
      tableStats.forEach(stat => {
        console.log(`   ${stat.table}: ${stat.count} registros`)
      })
      console.log('')
    }

    const productsCount = tableStats.find(s => s.table === 'products')?.count || 0
    const customersCount = tableStats.find(s => s.table === 'customers')?.count || 0
    
    if (productsCount === 0) {
      console.log('⚠️  No hay productos en la base de datos')
      console.log('')
      console.log('💡 Sugerencia: Ejecuta la migración de seed para poblar datos de ejemplo:')
      console.log('   1. Abre el SQL Editor en Supabase')
      console.log('   2. Ejecuta: supabase/migrations_legacy/02_simple_seed.sql')
      console.log('')
    } else {
      console.log('🎉 ¡Todo está listo! Tu aplicación está conectada a Supabase')
      console.log('')
      console.log('Puedes empezar a usar /dashboard/products')
      console.log('')
    }

    if (customersCount === 0) {
      console.log('⚠️  No hay clientes en la base de datos')
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        console.log('🔧 Insertando clientes de ejemplo usando Service Role...')
        const admin = createClient(supabaseUrl as string, serviceRoleKey as string)
        const sampleCustomers = [
          { name: 'Juan Pérez', email: 'juan.perez@email.com', phone: '+595981123456', city: 'Asunción', customer_type: 'premium', segment: 'vip', lifetime_value: 2500000, credit_score: 8, satisfaction_score: 9 },
          { name: 'María González', email: 'maria.gonzalez@email.com', phone: '+595981234567', city: 'Ciudad del Este', customer_type: 'regular', segment: 'regular', lifetime_value: 850000, credit_score: 6, satisfaction_score: 7 },
          { name: 'Carlos López', email: 'carlos.lopez@email.com', phone: '+595981345678', city: 'Encarnación', customer_type: 'empresa', segment: 'premium', lifetime_value: 1200000, credit_score: 7, satisfaction_score: 8 },
          { name: 'Ana Rodríguez', email: 'ana.rodriguez@email.com', phone: '+595981456789', city: 'Asunción', customer_type: 'regular', segment: 'regular', lifetime_value: 650000, credit_score: 5, satisfaction_score: 6 },
          { name: 'Luis Martínez', email: 'luis.martinez@email.com', phone: '+595981567890', city: 'San Lorenzo', customer_type: 'premium', segment: 'vip', lifetime_value: 3200000, credit_score: 9, satisfaction_score: 10 }
        ]
        try {
          const { error } = await admin.from('customers').insert(sampleCustomers)
          if (error) {
            console.log('❌ Error insertando clientes:', error.message)
          } else {
            console.log('✅ Clientes de ejemplo insertados')
          }
        } catch {
          console.log('❌ Error al insertar clientes')
        }
      } else {
        console.log('⚠️ No se puede insertar clientes automáticamente: falta SUPABASE_SERVICE_ROLE_KEY')
        console.log('   Opcional: Ejecuta supabase/migrations_legacy/20241214_verify_customers_table.sql en el SQL Editor')
      }
      console.log('')
    } else {
      console.log('✅ Clientes disponibles en la base de datos')
      console.log('')
    }
  } else {
    console.log('❌ Algunas tablas no existen o no son accesibles')
    console.log('')
    console.log('🔧 Solución: Ejecuta las migraciones en Supabase')
    console.log('')
    console.log('Opción 1 - Desde el Dashboard:')
    console.log('   1. Abre: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql')
    console.log('   2. Ejecuta en orden:')
    console.log('      - supabase/migrations_legacy/01_initial_schema.sql')
    console.log('      - supabase/migrations_legacy/03_functions.sql')
    console.log('      - supabase/migrations_legacy/04_ver_productos.sql')
    console.log('      - supabase/migrations_legacy/02_simple_seed.sql (opcional)')
    console.log('')
    console.log('Opción 2 - Usando Supabase CLI:')
    console.log('   supabase link --project-ref YOUR_PROJECT_ID')
    console.log('   supabase db push')
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Verificar funciones RPC
  console.log('🔧 Verificando Funciones RPC')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  try {
    const { error } = await supabase.rpc('get_top_selling_products', { limit_count: 1 })
    
    if (error) {
      console.log('❌ Función get_top_selling_products no existe')
      console.log(`   Error: ${error.message}`)
    } else {
      console.log('✅ Función get_top_selling_products existe')
    }
  } catch {
    console.log('❌ Error al verificar funciones RPC')
  }
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
}

// Ejecutar verificación
verifyConnection()
  .then(() => {
    console.log('✅ Verificación completada')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Error durante la verificación:', err)
    process.exit(1)
  })
