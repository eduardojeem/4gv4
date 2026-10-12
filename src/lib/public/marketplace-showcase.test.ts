import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SHOWCASE_BLOCKED_SUBSCRIPTION_STATUSES, blockedShowcaseOrganizationIds } from './marketplace'

const FUENTE = readFileSync(resolve(process.cwd(), 'src/lib/public/marketplace.ts'), 'utf8')

/**
 * El directorio de tiendas sacaba a las suspendidas, pero el catálogo, las
 * marcas, las categorías y las ofertas no: la tienda desaparecía del listado y
 * sus productos seguían a la venta en el marketplace.
 */
describe('qué tiendas entran en la vitrina pública', () => {
  it('deja afuera a las suspendidas, vencidas y dadas de baja', () => {
    const bloqueadas = blockedShowcaseOrganizationIds([
      { organization_id: 'al-dia', status: 'active' },
      { organization_id: 'prueba', status: 'trialing' },
      { organization_id: 'vencida', status: 'past_due' },
      { organization_id: 'baja', status: 'canceled' },
      { organization_id: 'suspendida', status: 'suspended' },
    ])

    expect([...bloqueadas].sort()).toEqual(['baja', 'suspendida', 'vencida'])
    expect(SHOWCASE_BLOCKED_SUBSCRIPTION_STATUSES).toEqual(['past_due', 'canceled', 'suspended'])
  })

  /** Sin fila de suscripción se pasa: ya optó por publicarse. */
  it('una tienda sin suscripción registrada sigue visible', () => {
    expect(blockedShowcaseOrganizationIds([]).size).toBe(0)
    expect(blockedShowcaseOrganizationIds(null).size).toBe(0)
    expect(blockedShowcaseOrganizationIds([{ organization_id: 'x', status: null }]).size).toBe(0)
  })

  it('la misma regla se aplica al catálogo, las marcas, las categorías y las ofertas', () => {
    // Desde 2fd85f79 los cuatro salen de la función del catálogo efectivo; antes
    // cada consulta llamaba a getShowcaseOrganizationIds por su cuenta.
    expect(FUENTE).toContain('return (await readEffectiveCatalog({ limit: 1 })).categories')
    expect(FUENTE).toContain('category_ids: categoryIds ?? undefined })).brands')
    expect(FUENTE).toContain('getMarketplaceProductsPageUncached(limit, { onlyOffers: true })')
    // Y los productos que se completan después también se acotan.
    expect(FUENTE).toContain(".in('organization_id', showcaseOrganizationIds)")
  })

  it('la función del catálogo saca los mismos estados que el código', () => {
    // La lista ahora vive en dos lugares: si se agrega un estado en uno y no en
    // el otro, la tienda desaparece del directorio pero sigue vendiendo.
    const ultima = readdirSync('supabase/migrations')
      .filter((archivo: string) => archivo.endsWith('.sql'))
      .sort()
      .map((archivo: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', archivo), 'utf8'))
      .filter((sql: string) => sql.includes('function public.get_marketplace_effective_catalog'))
      .at(-1) ?? ''
    const enSql = ultima.match(/s\.status::text in \(([^)]*)\)/)?.[1].match(/'([^']+)'/g)?.map((s: string) => s.slice(1, -1)).sort()
    expect(enSql).toEqual([...SHOWCASE_BLOCKED_SUBSCRIPTION_STATUSES].sort())
  })
})
