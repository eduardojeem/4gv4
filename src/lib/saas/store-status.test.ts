import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BLOCKED_STORE_SUBSCRIPTION_STATUSES,
  isOrganizationStoreBlocked,
  isStoreSubscriptionBlocked,
} from './store-status'
import { SHOWCASE_BLOCKED_SUBSCRIPTION_STATUSES } from '@/lib/public/marketplace'

/**
 * Una tienda con la suscripción en `past_due` desaparecía del marketplace pero
 * seguía abierta en su dirección: `/dabasica/productos`, `/inicio`, `/ofertas`
 * y la API de productos respondían 200 con el catálogo. El marketplace y la
 * tienda propia usaban dos reglas distintas.
 */

const clienteCon = (filas: Array<{ status: string | null }> | null, error: unknown = null) =>
  ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: filas, error }),
      }),
    }),
  }) as never

describe('cuándo una tienda puede vender en público', () => {
  it('la cierran la deuda, la baja y la suspensión', () => {
    expect(isStoreSubscriptionBlocked('past_due')).toBe(true)
    expect(isStoreSubscriptionBlocked('canceled')).toBe(true)
    expect(isStoreSubscriptionBlocked('suspended')).toBe(true)
  })

  it('una suscripción activa o en prueba la deja abierta', () => {
    expect(isStoreSubscriptionBlocked('active')).toBe(false)
    expect(isStoreSubscriptionBlocked('trialing')).toBe(false)
  })

  /** Excluir por un dato faltante vaciaría tiendas sin que nadie sepa por qué. */
  it('sin suscripción cargada no se cierra', async () => {
    expect(await isOrganizationStoreBlocked(clienteCon([]), 'org')).toBe(false)
    expect(isStoreSubscriptionBlocked(null)).toBe(false)
  })

  it('con cualquier fila bloqueada, se cierra', async () => {
    expect(await isOrganizationStoreBlocked(clienteCon([{ status: 'past_due' }]), 'org')).toBe(true)
  })

  it('si no se puede leer el estado, no cierra la tienda por un error de red', async () => {
    expect(await isOrganizationStoreBlocked(clienteCon(null, { message: 'timeout' }), 'org')).toBe(false)
  })
})

describe('una sola regla para el marketplace y la tienda propia', () => {
  it('el marketplace usa la misma lista, no una copia', () => {
    expect(SHOWCASE_BLOCKED_SUBSCRIPTION_STATUSES).toBe(BLOCKED_STORE_SUBSCRIPTION_STATUSES)
  })

  it('los resolvers de la tienda miran la suscripción, no sólo la publicación', () => {
    const tenant = readFileSync(resolve(process.cwd(), 'src/lib/saas/public-tenant.ts'), 'utf8')
    expect(tenant).toContain('isOrganizationStoreBlocked')
    // Los dos resolvers de tienda pasan por el mismo control.
    expect(tenant.match(/return openStorefrontOrNull\(/g) ?? []).toHaveLength(2)
  })

  /**
   * Lo que no es vender queda afuera a propósito: el cliente de una tienda
   * suspendida tiene que poder ver en qué quedó su reparación o su pedido.
   */
  it('el seguimiento de pedidos y reparaciones no usa la regla de la tienda', () => {
    for (const ruta of [
      'src/app/api/public/orders/track/route.ts',
      'src/app/api/public/repairs/[ticketId]/route.ts',
    ]) {
      const codigo = readFileSync(resolve(process.cwd(), ruta), 'utf8')
      expect(codigo, ruta).not.toContain('resolvePublicStorefrontOrganization')
    }
  })
})

/**
 * La fila de cada tienda salía de un único pozo de 288 productos ordenado a
 * nivel global: Store Center y MA se llevaban 278 lugares y 4G celulares
 * mostraba 1 de sus 5 productos publicados.
 */
describe('cada tienda trae sus propios destacados', () => {
  const marketplace = readFileSync(resolve(process.cwd(), 'src/lib/public/marketplace.ts'), 'utf8')

  it('se piden por tienda, con su propio tope', () => {
    expect(marketplace).toContain('organizationIds.map((organizationId) =>')
    expect(marketplace).toContain('.limit(FEATURED_PRODUCTS_PER_ORGANIZATION)')
  })

  it('ya no hay un pozo compartido entre todas las tiendas', () => {
    expect(marketplace).not.toContain('.limit(limit * 12)')
  })
})
