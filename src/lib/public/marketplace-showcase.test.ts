import { readFileSync } from 'node:fs'
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
    // Cada consulta pública acota por las organizaciones que sí pueden mostrarse.
    const usos = FUENTE.match(/await getShowcaseOrganizationIds\(supabase\)/g) ?? []
    expect(usos.length).toBeGreaterThanOrEqual(4)
    expect(FUENTE).toContain(".in('organization_id', showcaseOrganizationIds)")
  })
})
