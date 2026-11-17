import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
  } catch (err) {
    console.error('Error al cargar .env.local:', err)
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const email = 'analiak026@gmail.com'
  console.log(`Buscando usuario ${email}...`)

  // 1. Auth users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Error listUsers:', usersError)
    return
  }
  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.log('No se encontró el usuario en auth.users. Mostrando primeros 10:')
    console.log(users.slice(0, 10).map(u => ({ id: u.id, email: u.email })))
    return
  }
  console.log('Usuario encontrado:', { id: user.id, email: user.email })

  // 2. Organization members / user profiles
  const { data: members, error: memError } = await supabase
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id)
  
  console.log('Miembro de organizaciones:', JSON.stringify(members, null, 2))

  if (!members || members.length === 0) {
    // Check user_profiles or organizations created by this user
    const { data: orgs } = await supabase.from('organizations').select('*').limit(5)
    console.log('Algunas organizaciones existentes:', orgs)
  } else {
    const orgId = members[0].organization_id
    // Check website_settings
    const { data: ws } = await supabase.from('website_settings').select('*').eq('organization_id', orgId)
    console.log('Website settings actuales:', JSON.stringify(ws, null, 2))

    // Check categories
    const { data: cats } = await supabase.from('categories').select('*').eq('organization_id', orgId)
    console.log(`Categorías (${cats?.length || 0}):`, cats)

    // Check products
    const { data: prods } = await supabase.from('products').select('id, name, is_active, stock').eq('organization_id', orgId).limit(5)
    console.log(`Productos (${prods?.length || 0}):`, prods)

    // Check branches
    const { data: branches } = await supabase.from('branches').select('*').eq('organization_id', orgId)
    console.log(`Sucursales (${branches?.length || 0}):`, branches)

    // Check promotions
    const { data: promos } = await supabase.from('promotions').select('*').eq('organization_id', orgId)
    console.log(`Promociones (${promos?.length || 0}):`, promos)
  }
}

main().catch(console.error)
