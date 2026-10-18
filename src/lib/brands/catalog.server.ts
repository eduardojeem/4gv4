import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { GlobalBrand } from './global-catalog'

/** Las marcas oficiales activas. El catálogo es de la plataforma: se lee con el cliente de servicio. */
export async function loadCatalog(): Promise<GlobalBrand[]> {
  const { data, error } = await createAdminSupabase()
    .from('global_brands')
    .select('id, name, slug, aliases, logo_url, website, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(2000)
  if (error) throw error
  return (data ?? []) as GlobalBrand[]
}

/** Las marcas de la empresa, para saber cuáles oficiales ya tiene. */
export async function loadTenantBrands(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, global_brand_id')
    .eq('organization_id', organizationId)
  if (error) throw error
  return (data ?? []) as Array<{ id: string; name: string; global_brand_id: string | null }>
}

