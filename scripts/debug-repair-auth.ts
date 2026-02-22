/**
 * Script para debuggear la autenticación de reparaciones públicas
 * Verifica que los datos del cliente estén correctos
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

// Usar service role para bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function debugRepairAuth() {
  console.log('🔍 Debuggeando autenticación de reparaciones\n')

  // 1. Obtener una reparación reciente
  console.log('1️⃣ Buscando reparaciones recientes...')
  const { data: repairs, error: repairsError } = await supabase
    .from('repairs')
    .select('id, ticket_number, customer_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (repairsError) {
    console.error('❌ Error al buscar reparaciones:', repairsError)
    return
  }

  if (!repairs || repairs.length === 0) {
    console.log('⚠️  No hay reparaciones en la base de datos')
    return
  }

  console.log(`✅ Encontradas ${repairs.length} reparaciones\n`)

  // 2. Verificar cada reparación
  for (const repair of repairs) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📋 Ticket: ${repair.ticket_number}`)
    console.log(`🆔 ID: ${repair.id}`)
    console.log(`👤 Customer ID: ${repair.customer_id}`)

    // 3. Buscar datos del cliente
    if (repair.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('id', repair.customer_id)
        .single()

      if (customerError) {
        console.log('❌ Error al buscar cliente:', customerError.message)
      } else if (customer) {
        console.log('✅ Datos del cliente:')
        console.log(`   Nombre: ${customer.name}`)
        console.log(`   Email: ${customer.email || '(no configurado)'}`)
        console.log(`   Teléfono: ${customer.phone || '(no configurado)'}`)
        
        if (!customer.email && !customer.phone) {
          console.log('⚠️  PROBLEMA: Cliente sin email ni teléfono')
        }
      } else {
        console.log('⚠️  Cliente no encontrado')
      }
    } else {
      console.log('⚠️  PROBLEMA: Reparación sin customer_id')
    }

    // 4. Probar la consulta del endpoint
    console.log('\n🔍 Probando consulta del endpoint...')
    const { data: repairWithCustomer, error: queryError } = await supabase
      .from('repairs')
      .select(`
        id,
        ticket_number,
        customer:customers(id, name, email, phone)
      `)
      .eq('ticket_number', repair.ticket_number)
      .single()

    if (queryError) {
      console.log('❌ Error en consulta:', queryError.message)
    } else if (repairWithCustomer) {
      console.log('✅ Consulta exitosa')
      console.log('   Estructura customer:', typeof repairWithCustomer.customer)
      console.log('   Es array?:', Array.isArray(repairWithCustomer.customer))
      console.log('   Datos:', JSON.stringify(repairWithCustomer.customer, null, 2))
    }

    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📊 RESUMEN')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Para que la autenticación funcione, cada reparación debe tener:')
  console.log('  1. ✓ customer_id válido')
  console.log('  2. ✓ Cliente con email O teléfono')
  console.log('  3. ✓ Relación correcta en la consulta')
  console.log('')
  console.log('Si alguna reparación no cumple, la autenticación fallará.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

debugRepairAuth().catch(console.error)
