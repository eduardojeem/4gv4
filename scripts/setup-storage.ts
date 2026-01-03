
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const BUCKETS = [
  {
    id: 'repair-images',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  {
    id: 'product-images',
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  {
    id: 'avatars',
    public: true,
    fileSizeLimit: 2097152, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
]

async function setupStorage() {
  console.log('📦 Configurando Supabase Storage...')

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      throw new Error(`Error listando buckets: ${listError.message}`)
    }

    console.log(`✅ Buckets actuales: ${buckets.map(b => b.name).join(', ')}`)

    for (const bucketConfig of BUCKETS) {
      const existingBucket = buckets.find(b => b.name === bucketConfig.id)

      if (existingBucket) {
        console.log(`ℹ️ Bucket '${bucketConfig.id}' ya existe. Verificando configuración...`)
        
        // Actualizar configuración si es necesario (opcional)
        const { error: updateError } = await supabase.storage.updateBucket(bucketConfig.id, {
          public: bucketConfig.public,
          fileSizeLimit: bucketConfig.fileSizeLimit,
          allowedMimeTypes: bucketConfig.allowedMimeTypes
        })

        if (updateError) {
          console.warn(`⚠️ Error actualizando bucket '${bucketConfig.id}': ${updateError.message}`)
        } else {
          console.log(`✅ Bucket '${bucketConfig.id}' actualizado correctamente.`)
        }

      } else {
        console.log(`🔨 Creando bucket '${bucketConfig.id}'...`)
        const { error: createError } = await supabase.storage.createBucket(bucketConfig.id, {
          public: bucketConfig.public,
          fileSizeLimit: bucketConfig.fileSizeLimit,
          allowedMimeTypes: bucketConfig.allowedMimeTypes
        })

        if (createError) {
          console.error(`❌ Error creando bucket '${bucketConfig.id}': ${createError.message}`)
        } else {
          console.log(`✅ Bucket '${bucketConfig.id}' creado exitosamente.`)
        }
      }
    }

    console.log('\n🎉 Configuración de almacenamiento completada.')

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

setupStorage()
