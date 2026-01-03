
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

// Cliente anónimo (simulando frontend)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testUpload() {
  console.log('🧪 Probando subida con cliente anónimo...')
  
  // Crear un archivo dummy
  const fileName = `test-${Date.now()}.txt`
  const fileContent = 'Contenido de prueba'
  const file = new Blob([fileContent], { type: 'text/plain' })

  const { data, error } = await supabase.storage
    .from('repair-images')
    .upload(fileName, file)

  if (error) {
    console.error('❌ Error en subida anónima:', error.message)
    console.log('💡 Probablemente faltan políticas RLS (Row Level Security).')
  } else {
    console.log('✅ Subida exitosa:', data)
    
    // Limpiar
    await supabase.storage.from('repair-images').remove([fileName])
  }
}

testUpload()
