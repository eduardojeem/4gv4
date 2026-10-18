import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { catalogForVertical, sortGlobalCategories, type GlobalCategory } from './global-catalog'

/** El catálogo global que le sirve a una empresa: el de su rubro y el general. */
async function businessVertical(organizationId: string): Promise<string | null> {
  const { data } = await createAdminSupabase()
    .from('organizations')
    .select('business_vertical')
    .eq('id', organizationId)
    .maybeSingle()
  return (data as { business_vertical?: string | null } | null)?.business_vertical ?? null
}

export async function loadCatalogForOrganization(organizationId: string): Promise<{ vertical: string | null; catalog: GlobalCategory[] }> {
  const supabase = await createClient()
  const [vertical, { data, error }] = await Promise.all([
    businessVertical(organizationId),
    // Las activas son de lectura pública: no hace falta el cliente de servicio.
    supabase.from('global_categories').select('*').eq('is_active', true),
  ])
  if (error) throw error
  return { vertical, catalog: sortGlobalCategories(catalogForVertical((data ?? []) as GlobalCategory[], vertical)) }
}

