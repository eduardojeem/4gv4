#!/usr/bin/env tsx

/**
 * Script para configurar automáticamente los buckets de Supabase Storage
 * Ejecutar con: npx tsx scripts/setup-storage-buckets.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from '../src/lib/config'

const REQUIRED_BUCKETS = [
  {
    id: 'avatars',
    name: 'avatars',
    public: true,
    description: 'User profile avatars'
  },
  {
    id: 'repair-images',
    name: 'repair-images', 
    public: true,
    description: 'Images for repair documentation'
  },
  {
    id: 'product-images',
    name: 'product-images',
    public: true,
    description: 'Product catalog images'
  }
]

async function setupStorageBuckets() {
  console.log('🚀 Configurando buckets de Supabase Storage...\n')

  if (!config.supabase.isConfigured) {
    console.error('❌ Supabase no está configurado. Verifica las variables de entorno.')
    process.exit(1)
  }

  const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceKey || config.supabase.anonKey
  )

  try {
    // Verificar buckets existentes
    console.log('📋 Verificando buckets existentes...')
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Error al listar buckets:', listError.message)
      process.exit(1)
    }

    const existingBucketNames = existingBuckets?.map(b => b.name) || []
    console.log('✅ Buckets existentes:', existingBucketNames.join(', ') || 'ninguno')

    // Crear buckets faltantes
    for (const bucket of REQUIRED_BUCKETS) {
      if (existingBucketNames.includes(bucket.name)) {
        console.log(`✅ Bucket '${bucket.name}' ya existe`)
        continue
      }

      console.log(`📦 Creando bucket '${bucket.name}'...`)
      const { error: createError } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        allowedMimeTypes: bucket.name === 'avatars' 
          ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          : undefined,
        fileSizeLimit: bucket.name === 'avatars' ? 5 * 1024 * 1024 : undefined // 5MB para avatares
      })

      if (createError) {
        console.error(`❌ Error creando bucket '${bucket.name}':`, createError.message)
        continue
      }

      console.log(`✅ Bucket '${bucket.name}' creado exitosamente`)
    }

    // Configurar políticas RLS
    console.log('\n🔒 Configurando políticas de seguridad...')
    
    const policies = [
      // Política para lectura pública de avatares
      {
        name: 'avatars_public_read',
        sql: `
          CREATE POLICY "Public read access for avatars" ON storage.objects 
          FOR SELECT USING (bucket_id = 'avatars');
        `
      },
      // Política para que usuarios autenticados puedan subir avatares
      {
        name: 'avatars_authenticated_upload',
        sql: `
          CREATE POLICY "Authenticated users can upload avatars" ON storage.objects 
          FOR INSERT WITH CHECK (
            bucket_id = 'avatars' 
            AND auth.role() = 'authenticated'
            AND (storage.foldername(name))[1] = auth.uid()::text
          );
        `
      },
      // Política para que usuarios puedan actualizar sus propios avatares
      {
        name: 'avatars_own_update',
        sql: `
          CREATE POLICY "Users can update own avatars" ON storage.objects 
          FOR UPDATE USING (
            bucket_id = 'avatars' 
            AND auth.role() = 'authenticated'
            AND (storage.foldername(name))[1] = auth.uid()::text
          );
        `
      },
      // Política para que usuarios puedan eliminar sus propios avatares
      {
        name: 'avatars_own_delete',
        sql: `
          CREATE POLICY "Users can delete own avatars" ON storage.objects 
          FOR DELETE USING (
            bucket_id = 'avatars' 
            AND auth.role() = 'authenticated'
            AND (storage.foldername(name))[1] = auth.uid()::text
          );
        `
      }
    ]

    for (const policy of policies) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: policy.sql })
        if (error && !error.message.includes('already exists')) {
          console.warn(`⚠️  Advertencia configurando política ${policy.name}:`, error.message)
        } else {
          console.log(`✅ Política ${policy.name} configurada`)
        }
      } catch (err) {
        console.warn(`⚠️  No se pudo configurar la política ${policy.name}:`, err)
      }
    }

    console.log('\n🎉 ¡Configuración de storage completada!')
    console.log('\n📝 Buckets configurados:')
    REQUIRED_BUCKETS.forEach(bucket => {
      console.log(`  - ${bucket.name}: ${bucket.description}`)
    })

  } catch (error) {
    console.error('❌ Error durante la configuración:', error)
    process.exit(1)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupStorageBuckets()
}

export { setupStorageBuckets }