'use strict'

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const emailArg = args.find(a => a.startsWith('--email='))
  const email = emailArg ? emailArg.split('=')[1] : 'jeem101595@gmail.com'

  if (!email || !email.includes('@')) {
    console.error('Email inválido. Usa: node scripts/grant-super-admin.js --email=usuario@example.com')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    console.log(`Buscando/creando usuario para: ${email}`)

    // Buscar usuario por email en auth
    let targetUser = null
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    targetUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null

    if (!targetUser) {
      console.log('Usuario no encontrado. Creando usuario...')
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: 'Super Admin' }
      })
      if (createError) throw createError
      targetUser = createData.user
      console.log('✓ Usuario creado:', targetUser.id)
    } else {
      console.log('✓ Usuario existente:', targetUser.id)
    }

    // Asegurar perfil con rol UI 'admin'
    console.log('Asignando rol UI "admin" en profiles...')
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: targetUser.id,
        role: 'admin',
        full_name: 'Super Admin',
        updated_at: new Date().toISOString()
      })
    if (profileError) throw profileError
    console.log('✓ Perfil actualizado (UI rol admin)')

    // Asignar rol DB 'super_admin' en user_roles
    console.log('Asignando rol DB "super_admin" en user_roles...')
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: targetUser.id,
        role: 'admin',
        is_active: true,
        updated_at: new Date().toISOString()
      })
    if (roleError) throw roleError
    console.log('✓ Rol admin asignado en user_roles')

    // Opcional: registrar en auditoría
    try {
      await supabase.from('audit_log').insert({
        user_id: targetUser.id,
        action: 'grant_admin',
        resource: 'auth',
        resource_id: targetUser.id,
        new_values: { role_ui: 'admin', role_db: 'admin' }
      })
    } catch (_) {}

    console.log('✅ Operación completada: el usuario tiene rol UI admin y rol DB admin')
  } catch (err) {
    console.error('❌ Error otorgando super admin:', err && err.message ? err.message : err)
    process.exit(1)
  }
}

main()
