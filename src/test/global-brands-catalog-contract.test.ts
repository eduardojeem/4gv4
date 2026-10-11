import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const MIGRACION = leer('supabase/migrations_legacy/20260915120000_global_brands_catalog.sql')
const API_EMPRESA = leer('src/app/api/brands/route.ts')
const API_CATALOGO = leer('src/app/api/brands/catalog/route.ts')
const API_SUPERADMIN = leer('src/app/api/superadmin/global-brands/route.ts')

/**
 * El marketplace agrupa las marcas por nombre y mostraba el primer logo
 * cargado: la imagen que subía una empresa representaba a esa marca para todas.
 * El logo pasa a ser un dato de la plataforma.
 */
describe('catálogo global de marcas', () => {
  it('la marca de la empresa apunta al catálogo, que administra la plataforma', () => {
    expect(MIGRACION).toContain('create table if not exists public.global_brands')
    expect(MIGRACION).toContain('add column if not exists global_brand_id uuid')
    // Sin política de escritura: solo el service role (superadmin) puede tocarlo.
    expect(MIGRACION).toContain('for select using')
    expect(MIGRACION).not.toMatch(/for (insert|update|delete)/i)
  })

  it('la API de la empresa nunca guarda el logo que manda el navegador', () => {
    expect(API_EMPRESA).toContain('resolveTenantBrandFields')
    expect(API_EMPRESA).toContain('global_brand_id')
  })

  it('la empresa solo lee el catálogo', () => {
    expect(API_CATALOGO).toContain('searchGlobalBrands')
    expect(API_CATALOGO).not.toMatch(/export const (POST|PUT|DELETE)/)
  })

  it('el catálogo se administra desde el superadmin, con auditoría', () => {
    expect(API_SUPERADMIN).toContain('getSuperAdminUser')
    expect(API_SUPERADMIN).toContain('logSuperAdminAction')
    // Un logo oficial sale de un origen permitido.
    expect(API_SUPERADMIN).toContain('isSupportedImageSource')
    // La baja es lógica: borrar desvincularía las marcas de las empresas.
    expect(API_SUPERADMIN).toContain("update({ is_active: false")
  })

  /**
   * Vincular por nombre no alcanza: casi ninguna marca de empresa existe en el
   * catálogo todavía, y esas quedaban fuera de la pantalla.
   */
  it('las que no están en el catálogo se pueden crear desde ahí', () => {
    const categorias = leer('src/app/api/superadmin/global-categories/route.ts')

    for (const api of [API_SUPERADMIN, categorias]) {
      expect(api).toContain('groupUnmatched')
      expect(api).toContain("action === 'create-from-tenant'")
      // Vincular nunca pisa lo que ya decidió alguien.
      expect(api).toMatch(/\.is\('global_(brand|category)_id', null\)/)
    }
  })

  it('el superadmin también administra la taxonomía de categorías', () => {
    const api = leer('src/app/api/superadmin/global-categories/route.ts')
    const menu = leer('src/components/superadmin/superadmin-shell.tsx')

    expect(api).toContain('getSuperAdminUser')
    expect(api).toContain('suggestCategoryLinks')
    expect(menu).toContain("href: '/superadmin/brands'")
    expect(menu).toContain("href: '/superadmin/categories'")
  })

  it('el marketplace muestra solo el logo oficial', () => {
    // Desde 2fd85f79 las marcas del marketplace salen de la función del
    // catálogo efectivo: la regla vive en su última versión.
    const migraciones = readdirSync('supabase/migrations')
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort()
      .map((archivo) => leer(`supabase/migrations/${archivo}`))
      .filter((sql) => sql.includes('function public.get_marketplace_effective_catalog'))
    const ultima = migraciones.at(-1) ?? ''

    expect(ultima).toContain('gb.logo_url as brand_logo')
    // El logo de la marca de una tienda no puede representar a la marca para todas.
    expect(ultima).not.toContain('coalesce(gb.logo_url,b.logo_url)')
  })
})
