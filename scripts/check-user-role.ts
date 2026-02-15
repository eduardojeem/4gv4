#!/usr/bin/env tsx
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
          const value = valueParts.join('=').trim()
          process.env[key.trim()] = value
        }
      }
    })
  } catch {}
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Supabase no configurado. Revise .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const email = args[0]
if (!email) {
  console.error('Uso: npx tsx scripts/check-user-role.ts <email>')
  process.exit(1)
}

const client = createClient(supabaseUrl, serviceKey || anonKey)

async function main() {
  // Buscar usuario en auth.users si tenemos service role
  let userId: string | null = null
  if (serviceKey) {
    const { data: authUser, error: authErr } = await client
      .from('auth.users' as any)
      .select('id,email')
      .eq('email', email)
      .maybeSingle()
    if (authErr) {
      console.log('No se pudo leer auth.users con service role:', authErr.message)
    }
    userId = authUser?.id ?? null
  }

  // Fallback: perfiles por email
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id,email,role,permissions')
    .eq('email', email)
    .maybeSingle()

  if (profileErr) {
    console.error('Error leyendo profiles:', profileErr.message)
    process.exit(1)
  }

  if (!profile) {
    console.log('No existe perfil para el email:', email)
    process.exit(0)
  }

  // Leer user_roles si tenemos id
  let userRoleRow: { role?: string } | null = null
  if (profile.id) {
    const { data: ur } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle()
    userRoleRow = ur
  }

  console.log('Email:', email)
  console.log('ID:', profile.id)
  console.log('Role (profiles):', profile.role)
  console.log('Role (user_roles):', userRoleRow?.role || '(sin fila)')
  console.log('Permissions:', Array.isArray(profile.permissions) ? profile.permissions.join(', ') : '(ninguno)')
}

main().catch(err => {
  console.error('Error:', err?.message || String(err))
  process.exit(1)
})

