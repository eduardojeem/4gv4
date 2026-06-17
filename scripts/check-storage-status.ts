#!/usr/bin/env tsx

/**
 * Script para verificar rápidamente el estado del storage de Supabase
 * Ejecutar con: npx tsx scripts/check-storage-status.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from '../src/lib/config'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const REQUIRED_BUCKETS = ['avatars', 'repair-images', 'product-images']

async function checkStorageStatus() {
  console.log('🔍 Verificando estado de Supabase Storage...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase no está configurado')
    console.log('   Verifica las variables de entorno:')
    console.log('   - NEXT_PUBLIC_SUPABASE_URL')
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Verificar conexión
    console.log('🔗 Verificando conexión a Supabase...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError && 
        !authError.message.includes('session_not_found') && 
        !authError.message.includes('Auth session missing')) {
      console.error('❌ Error de conexión:', authError.message)
      process.exit(1)
    }
    console.log('✅ Conexión a Supabase OK')

    // Verificar buckets
    console.log('\n📦 Verificando buckets de storage...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('❌ Error listando buckets:', bucketsError.message)
      process.exit(1)
    }

    const existingBuckets = buckets?.map(b => b.name) || []
    console.log(`   Buckets existentes: ${existingBuckets.join(', ') || 'ninguno'}`)

    let allOk = true
    for (const requiredBucket of REQUIRED_BUCKETS) {
      const exists = existingBuckets.includes(requiredBucket)
      const bucket = buckets?.find(b => b.name === requiredBucket)
      
      if (exists) {
        console.log(`   ✅ ${requiredBucket}: Existe ${bucket?.public ? '(público)' : '(privado)'}`)
      } else {
        console.log(`   ❌ ${requiredBucket}: No encontrado`)
        allOk = false
      }
    }

    // Verificar permisos de subida (solo si hay buckets)
    if (existingBuckets.length > 0) {
      console.log('\n🔐 Verificando permisos de subida...')
      try {
        // Intentar subir un archivo de prueba pequeño
        const testFile = new File(['test'], 'test.txt', { type: 'text/plain' })
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload('test/test.txt', testFile)
        
        if (uploadError) {
          if (uploadError.message.includes('not found')) {
            console.log('   ⚠️  Bucket avatars no encontrado')
          } else if (uploadError.message.includes('permission')) {
            console.log('   ⚠️  Sin permisos de subida (normal para usuarios no autenticados)')
          } else {
            console.log(`   ⚠️  Error de subida: ${uploadError.message}`)
          }
        } else {
          console.log('   ✅ Permisos de subida OK')
          // Limpiar archivo de prueba
          await supabase.storage.from('avatars').remove(['test/test.txt'])
        }
      } catch (error) {
        console.log('   ⚠️  No se pudo verificar permisos de subida')
      }
    }

    // Resumen final
    console.log('\n📋 RESUMEN:')
    if (allOk) {
      console.log('✅ Storage configurado correctamente')
      console.log('   Todos los buckets requeridos están presentes')
    } else {
      console.log('❌ Storage necesita configuración')
      console.log('\n🔧 Para solucionarlo:')
      console.log('   1. Ejecuta: npx tsx scripts/setup-storage-buckets.ts')
      console.log('   2. O configura manualmente en Supabase Dashboard')
      console.log('   3. O ejecuta el SQL: scripts/setup-storage-buckets.sql')
      console.log('\n📖 Ver más detalles en: STORAGE_SETUP.md')
    }

  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
    process.exit(1)
  }
}

import { fileURLToPath } from 'url'

// Ejecutar si es llamado directamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkStorageStatus()
}

export { checkStorageStatus }