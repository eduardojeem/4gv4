import {
  DEFAULT_PLATFORM_POLICIES,
  loadPlatformPolicies,
  type PlatformPolicies,
  type PlatformPolicyClient,
} from './policies'

/**
 * Lee las políticas globales con la clave de servicio, en un cliente propio
 * que solo consulta `system_settings` (RLS solo deja leer esa fila a los
 * administradores de la plataforma). No usa el cliente de servicio general
 * para que las rutas sigan sin tocarlo hasta validar el pedido.
 */
export async function readPlatformPolicies(): Promise<PlatformPolicies> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return { ...DEFAULT_PLATFORM_POLICIES }
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  return loadPlatformPolicies(client as unknown as PlatformPolicyClient)
}
