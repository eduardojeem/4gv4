
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCustomerData() {
  console.log('Verificando datos de clientes...')
  
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, email')
    .limit(5)
    
  if (error) {
    console.log(`❌ Error: ${error.message}`)
    return
  }
  
  console.log('Muestra de clientes:', data)
  
  if (data && data.length > 0) {
    const missingNames = data.filter(c => !c.first_name && !c.last_name).length
    if (missingNames > 0) {
      console.log(`⚠️ Advertencia: ${missingNames} clientes no tienen first_name/last_name.`)
    } else {
      console.log('✅ Todos los clientes de la muestra tienen nombres.')
    }
  }
}

checkCustomerData()
