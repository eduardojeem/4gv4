import type { createAdminSupabase } from '@/lib/supabase/admin'
import { findGlobalBrandByName, normalizeBrandName, type GlobalBrand } from '@/lib/brands/global-catalog'

/**
 * La marca de un producto se guardaba dos veces sin conectarse: el texto
 * (`products.brand`) y el vínculo a la marca de la tienda (`brand_id`). La
 * importación mandaba solo el texto (57 productos quedaron sin vínculo, fuera
 * de su marca en filtros y marketplace) y al cambiar el vínculo el texto
 * quedaba viejo («FTX» con la marca «FASTRAX»).
 *
 * Regla: el vínculo manda y el texto es siempre el nombre de esa marca. Si
 * solo llega el texto, se busca la marca de la tienda (por nombre o por la
 * marca del catálogo que le corresponde) y, si no existe, se crea.
 */

export type TenantBrandRow = { id: string; name: string; global_brand_id: string | null }

export type ProductBrandPlan =
  | { action: 'clear' }
  | { action: 'use'; id: string; name: string }
  | { action: 'create'; name: string; global_brand_id: string | null; logo_url: string | null }
  | { action: 'invalid' }

export function planProductBrand(
  input: { brand?: string | null; brand_id?: string | null },
  tenantBrands: TenantBrandRow[],
  catalog: GlobalBrand[],
): ProductBrandPlan {
  if (input.brand_id) {
    const linked = tenantBrands.find((brand) => brand.id === input.brand_id)
    return linked ? { action: 'use', id: linked.id, name: linked.name } : { action: 'invalid' }
  }

  const text = String(input.brand ?? '').trim()
  if (!text) return { action: 'clear' }

  // «Iphone» es Apple en el catálogo: si la tienda ya tiene Apple vinculada, es esa.
  const global = findGlobalBrandByName(text, catalog)
  if (global) {
    const linked = tenantBrands.find((brand) => brand.global_brand_id === global.id)
    if (linked) return { action: 'use', id: linked.id, name: linked.name }
  }

  const key = normalizeBrandName(text)
  const sameName = tenantBrands.find((brand) => normalizeBrandName(brand.name) === key)
    ?? (global ? tenantBrands.find((brand) => normalizeBrandName(brand.name) === normalizeBrandName(global.name)) : undefined)
  if (sameName) return { action: 'use', id: sameName.id, name: sameName.name }

  return global
    ? { action: 'create', name: global.name, global_brand_id: global.id, logo_url: global.logo_url?.trim() || null }
    : { action: 'create', name: text.slice(0, 200), global_brand_id: null, logo_url: null }
}

type Admin = ReturnType<typeof createAdminSupabase>

/**
 * Los dos campos listos para guardar. Lanza si el vínculo no es de la tienda:
 * nadie puede poner en su producto la marca de otra empresa.
 */
export async function resolveProductBrand(
  admin: Admin,
  organizationId: string,
  input: { brand?: string | null; brand_id?: string | null },
): Promise<{ brand: string | null; brand_id: string | null }> {
  const hasText = Boolean(String(input.brand ?? '').trim())
  if (!input.brand_id && !hasText) return { brand: null, brand_id: null }

  const [{ data: tenantBrands }, { data: catalog }] = await Promise.all([
    admin.from('brands').select('id, name, global_brand_id').eq('organization_id', organizationId).limit(2000),
    input.brand_id
      ? Promise.resolve({ data: [] })
      : admin.from('global_brands').select('id, name, slug, aliases, logo_url, is_active').eq('is_active', true),
  ])

  const plan = planProductBrand(input, (tenantBrands ?? []) as TenantBrandRow[], (catalog ?? []) as unknown as GlobalBrand[])
  if (plan.action === 'invalid') throw new ProductBrandError('La marca elegida no es de esta tienda.')
  if (plan.action === 'clear') return { brand: null, brand_id: null }
  if (plan.action === 'use') return { brand: plan.name, brand_id: plan.id }

  const { data: created, error } = await admin
    .from('brands')
    .insert({
      organization_id: organizationId,
      name: plan.name,
      global_brand_id: plan.global_brand_id,
      logo_url: plan.logo_url,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select('id, name')
    .single()
  if (error || !created) throw new ProductBrandError('No se pudo crear la marca del producto.')
  return { brand: (created as { name: string }).name, brand_id: (created as { id: string }).id }
}

export class ProductBrandError extends Error {
  readonly status = 400
}
