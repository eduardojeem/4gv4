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
if (!supabaseUrl || !anonKey) {
  console.error('Supabase no configurado. Revise .env.local')
  process.exit(1)
}

const client = createClient(supabaseUrl, anonKey)

async function main() {
  const { data, error } = await client
    .from('profiles')
    .select('id,email,full_name,role')
    .in('role', ['mayorista','client_mayorista'])
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('Usuarios mayoristas:')
  (data || []).forEach(p => {
    console.log(`- ${p.full_name || '(sin nombre)'} <${p.email || '(sin email)'}> (${p.id}) role=${p.role}`)
  })
}

main().catch(err => {
  console.error('Error:', err?.message || String(err))
  process.exit(1)
})

