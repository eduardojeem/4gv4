import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { config, isDemoNoDb } from '../config'
import { createMockSupabaseClient } from './mock'

export function createClient(): SupabaseClient {
  // Evitar crear cliente real si Supabase no está configurado
  if (!config.supabase.isConfigured) {
    return createMockSupabaseClient()
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location?.protocol
    if (protocol === 'file:') {
      console.warn('Ejecutando desde file://, usando cliente Supabase mock para evitar errores de red')
      return createMockSupabaseClient()
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn('Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Usando cliente mock.')
    return createMockSupabaseClient()
  }

  return createBrowserClient(url, anonKey)
}

export { createClient as createSupabaseClient }
