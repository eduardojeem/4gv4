#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno faltantes para Supabase')
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌')
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  const users = data && Array.isArray(data.users) ? data.users : []
  return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null
}

async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email)
  if (existing) return existing

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { roles: ['technician'] },
  })
  if (error) throw error
  return data.user
}

async function getProfilesRoleType() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .limit(1)
    if (error) throw error
    return 'unknown'
  } catch (err) {
    const msg = String(err.message || err)
    if (msg.includes('invalid input value for enum') || msg.includes('enum')) {
      return 'enum'
    }
    if (msg.includes('relation') && msg.includes('does not exist')) {
      return 'missing'
    }
    return 'unknown'
  }
}

async function upsertProfile({ id, email, full_name }) {
  let roleToUse = 'technician'
  let lastErr = null

  const attempt = async (role) => {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id, email, full_name, role },
        { onConflict: 'id' }
      )
    return error || null
  }

  let err = await attempt(roleToUse)
  if (err) {
    lastErr = err
    const msg = (err && err.message) ? err.message.toLowerCase() : ''
    const enumError = msg.includes('invalid input value for enum') || msg.includes('enum')
    if (enumError) {
      roleToUse = 'tecnico'
      err = await attempt(roleToUse)
      if (err) lastErr = err
    }
  }

  if (lastErr) throw lastErr
  return roleToUse
}

async function run() {
  const email = 'johneduardoespinoza95@gmail.com'
  const fullName = 'John Eduardo Espinoza'

  console.log('🚀 Configurando técnico de ejemplo para dashboard/technician')
  console.log('📧 Email:', email)

  try {
    const user = await ensureUser(email, fullName)
    const userId = user.id

    const roleUsed = await upsertProfile({ id: userId, email, full_name: fullName })

    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single()

    if (readErr) throw readErr

    console.log('✅ Técnico creado/actualizado correctamente')
    console.log('🆔 ID:', profile.id)
    console.log('📧 Email:', profile.email)
    console.log('👤 Nombre:', profile.full_name || '(sin nombre)')
    console.log('🛠️ Rol aplicado:', roleUsed)
    console.log('ℹ️ Esta cuenta aparecerá en la sección dashboard/technician')
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    console.error('❌ Error durante la configuración:', msg)
    if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('profiles')) {
      console.log('⚠️ La tabla `profiles` no existe o tiene un esquema diferente.')
      console.log('Ejecuta las migraciones de base de datos antes de correr este script.')
    }
    process.exit(1)
  }
}

if (require.main === module) {
  run()
}

module.exports = { run }
