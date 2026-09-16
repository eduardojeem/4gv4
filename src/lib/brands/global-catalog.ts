/**
 * Catálogo global de marcas.
 *
 * El logo de una marca es de la plataforma, no de cada empresa: el marketplace
 * agrupa las marcas por nombre y mostraba el primer logo cargado, así que la
 * imagen que subía una empresa representaba a esa marca para todas.
 *
 * Acá viven las reglas que comparten la API de la empresa, la del superadmin y
 * el marketplace, para que una marca no sea oficial en una pantalla y libre en
 * otra.
 */

export type GlobalBrand = {
  id: string
  name: string
  slug: string
  aliases?: string[] | null
  logo_url?: string | null
  website?: string | null
  is_active?: boolean | null
}

export type TenantBrandFields = {
  name: string
  logo_url: string | null
  global_brand_id: string | null
}

/** Sin tildes, sin signos y en minúsculas: «Samsung Electronics» y «samsung-electronics» son lo mismo. */
export function normalizeBrandName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function brandSlug(value: string | null | undefined): string {
  return normalizeBrandName(value).replace(/\s+/g, '-')
}

/** La marca del catálogo que corresponde a un nombre escrito a mano, si la hay. */
export function findGlobalBrandByName(
  name: string | null | undefined,
  catalog: GlobalBrand[],
): GlobalBrand | null {
  const needle = normalizeBrandName(name)
  if (!needle) return null

  for (const brand of catalog) {
    if (brand.is_active === false) continue
    if (normalizeBrandName(brand.name) === needle) return brand
    if (brandSlug(brand.slug) === needle.replace(/\s+/g, '-')) return brand
    if ((brand.aliases ?? []).some((alias) => normalizeBrandName(alias) === needle)) return brand
  }

  return null
}

/**
 * Qué se guarda en la marca de la empresa.
 *
 * Vinculada al catálogo: el nombre y el logo los pone la plataforma, y lo que
 * haya mandado el navegador se ignora. Sin vincular: no hay logo, se muestra la
 * inicial. Así ninguna empresa puede poner una imagen en una marca ajena.
 */
export function resolveTenantBrandFields(
  input: { name?: string | null; logo_url?: string | null; global_brand_id?: string | null },
  globalBrand: GlobalBrand | null,
): TenantBrandFields {
  if (globalBrand) {
    return {
      name: globalBrand.name,
      logo_url: globalBrand.logo_url?.trim() || null,
      global_brand_id: globalBrand.id,
    }
  }

  return {
    name: String(input.name ?? '').trim(),
    logo_url: null,
    global_brand_id: null,
  }
}

/** Igual pero sin plurales ni espacios: «JBL» y «J B L» son la misma marca. */
function compact(value: string): string {
  return normalizeBrandName(value).replace(/\s+/g, '')
}

/**
 * La marca del catálogo parecida, cuando no hay una igual. Es una propuesta
 * para revisar: vuelve marcada como aproximada.
 */
export function findSimilarGlobalBrand(name: string | null | undefined, catalog: GlobalBrand[]): GlobalBrand | null {
  const needle = compact(name ?? '')
  if (needle.length < 3) return null

  for (const brand of catalog) {
    if (brand.is_active === false) continue
    if (compact(brand.name) === needle) return brand
    if ((brand.aliases ?? []).some((alias) => compact(alias) === needle)) return brand
  }

  return null
}

export type BrandLinkSuggestion = { id: string; global_brand_id: string; exact: boolean }

/** Lo que se propone vincular: primero los nombres iguales, después los parecidos. */
export function suggestBrandLinks(
  tenantBrands: Array<{ id: string; name: string; global_brand_id?: string | null }>,
  catalog: GlobalBrand[],
): BrandLinkSuggestion[] {
  return tenantBrands.flatMap<BrandLinkSuggestion>((brand) => {
    if (brand.global_brand_id) return []
    const exact = findGlobalBrandByName(brand.name, catalog)
    if (exact) return [{ id: brand.id, global_brand_id: exact.id, exact: true }]
    const similar = findSimilarGlobalBrand(brand.name, catalog)
    return similar ? [{ id: brand.id, global_brand_id: similar.id, exact: false }] : []
  })
}

/** Marcas del catálogo que coinciden con lo que se está escribiendo. */
export function searchGlobalBrands(query: string | null | undefined, catalog: GlobalBrand[], limit = 20): GlobalBrand[] {
  const needle = normalizeBrandName(query)
  const active = catalog.filter((brand) => brand.is_active !== false)
  if (!needle) return active.slice(0, limit)

  const scored = active
    .map((brand) => {
      const name = normalizeBrandName(brand.name)
      const aliases = (brand.aliases ?? []).map(normalizeBrandName)
      if (name === needle || aliases.includes(needle)) return { brand, score: 0 }
      if (name.startsWith(needle)) return { brand, score: 1 }
      if (name.includes(needle) || aliases.some((alias) => alias.includes(needle))) return { brand, score: 2 }
      return null
    })
    .filter((row): row is { brand: GlobalBrand; score: number } => row !== null)
    .sort((a, b) => a.score - b.score || a.brand.name.localeCompare(b.brand.name, 'es'))

  return scored.slice(0, limit).map((row) => row.brand)
}
