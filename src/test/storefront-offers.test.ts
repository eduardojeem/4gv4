/**
 * Regresión para getStorefrontOffers (página pública /ofertas).
 *
 * El bug: la query de productos prefiltraba `.eq('has_offer', true)` en la base
 * y recién después aplicaba las promociones automáticas. Como una oferta
 * automática existe justamente para generar descuento sobre productos que NO
 * tienen has_offer marcado, esos productos nunca entraban a la query y la
 * promoción no aparecía nunca en /ofertas.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

const PRODUCT_WITH_MANUAL_OFFER = '11111111-1111-4111-8111-111111111111'
const PRODUCT_WITH_AUTOMATIC_ONLY = '22222222-2222-4222-8222-222222222222'
const REAL_CATEGORY_ID = '33333333-3333-4333-8333-333333333333'

type QueryCall = { method: string; args: unknown[] }

/** Llamadas registradas por tabla en la última corrida. */
let callsByTable: Record<string, QueryCall[]>
/** Filas que devuelve el cliente falso por tabla. */
let rowsByTable: Record<string, unknown>

function createFakeClient() {
  callsByTable = {}

  return {
    from(table: string) {
      const calls: QueryCall[] = []
      callsByTable[table] = calls

      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            const rows = rowsByTable[table]
            const isSingle = calls.some((call) => call.method === 'maybeSingle' || call.method === 'single')
            // Se aplican los .eq() sobre las filas: sin esto, un prefiltro de
            // base equivocado (ej. .eq('has_offer', true)) pasaría inadvertido.
            const filtered = Array.isArray(rows)
              ? rows.filter((row) => calls
                .filter((call) => call.method === 'eq')
                .every((call) => {
                  const [column, value] = call.args as [string, unknown]
                  const record = row as Record<string, unknown>
                  return !(column in record) || record[column] === value
                }))
              : rows
            const data = isSingle ? (Array.isArray(filtered) ? filtered[0] ?? null : filtered ?? null) : filtered ?? []
            return (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
          }
          return (...args: unknown[]) => {
            calls.push({ method: String(prop), args })
            return builder
          }
        },
      }) as Record<string | symbol, unknown>

      return builder
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => createFakeClient(),
}))

import { getStorefrontOffers } from '@/lib/public/marketplace'

function productRow(overrides: Record<string, unknown>) {
  return {
    organization_id: 'org-1',
    name: 'Producto',
    sku: 'SKU',
    description: null,
    brand: null,
    sale_price: 100_000,
    stock_quantity: 5,
    is_active: true,
    visibility: 'public',
    featured: false,
    has_offer: false,
    offer_price: null,
    image_url: null,
    images: null,
    unit_measure: 'unidad',
    barcode: null,
    categories: { id: REAL_CATEGORY_ID, name: 'Celulares' },
    ...overrides,
  }
}

function orFilterArg() {
  const call = callsByTable.products?.find((entry) => entry.method === 'or')
  return call ? String(call.args[0]) : null
}

describe('getStorefrontOffers', () => {
  beforeEach(() => {
    rowsByTable = {
      organizations: [{
        id: 'org-1',
        name: 'Tienda',
        slug: 'default',
        plan: null,
        logo_url: null,
        marketplace_public: true,
      }],
      promotions: [],
      products: [],
    }
  })

  it('publica un producto sin oferta manual alcanzado por una promoción automática', async () => {
    rowsByTable.promotions = [{
      id: 'promo-1',
      code: 'AUTO20',
      name: 'Oferta publica',
      type: 'percentage',
      value: 20,
      min_purchase: null,
      max_discount: null,
      applicable_products: [PRODUCT_WITH_AUTOMATIC_ONLY],
      applicable_categories: [],
      start_date: null,
      end_date: null,
      is_active: true,
      usage_count: 0,
      usage_limit: null,
      public_mode: 'automatic',
    }]
    rowsByTable.products = [
      productRow({ id: PRODUCT_WITH_AUTOMATIC_ONLY, name: 'Solo automatica', has_offer: false, offer_price: null }),
    ]

    const offers = await getStorefrontOffers('default')

    expect(offers).toHaveLength(1)
    expect(offers[0].id).toBe(PRODUCT_WITH_AUTOMATIC_ONLY)
    expect(offers[0].offer_price).toBe(80_000)
    expect(offers[0].promotion_name).toBe('Oferta publica')
  })

  it('no prefiltra has_offer en la base: usa un OR de candidatos', async () => {
    rowsByTable.promotions = [{
      id: 'promo-1',
      name: 'Oferta publica',
      code: 'AUTO20',
      type: 'percentage',
      value: 20,
      applicable_products: [PRODUCT_WITH_AUTOMATIC_ONLY],
      applicable_categories: [REAL_CATEGORY_ID],
      is_active: true,
      usage_count: 0,
      usage_limit: null,
      public_mode: 'automatic',
    }]

    await getStorefrontOffers('default')

    const hasOfferEquality = callsByTable.products?.some(
      (call) => call.method === 'eq' && call.args[0] === 'has_offer'
    )
    expect(hasOfferEquality).toBe(false)

    const filter = orFilterArg()
    expect(filter).toContain('has_offer.eq.true')
    expect(filter).toContain(`id.in.(${PRODUCT_WITH_AUTOMATIC_ONLY})`)
    expect(filter).toContain(`category_id.in.(${REAL_CATEGORY_ID})`)
  })

  it('descarta centinelas no-UUID de applicable_categories', async () => {
    // El formulario del dashboard guarda 'service' para promos de reparaciones.
    // Mandarlo a un filtro sobre una columna uuid abortaría la query entera.
    rowsByTable.promotions = [{
      id: 'promo-1',
      name: 'Reparaciones',
      code: 'FIX10',
      type: 'percentage',
      value: 10,
      applicable_products: [],
      applicable_categories: ['service'],
      is_active: true,
      usage_count: 0,
      usage_limit: null,
      public_mode: 'automatic',
    }]

    await getStorefrontOffers('default')

    const filter = orFilterArg()
    expect(filter).not.toContain('service')
    expect(filter).toBe('has_offer.eq.true')
  })

  it('sigue publicando las ofertas manuales cuando no hay promociones automáticas', async () => {
    rowsByTable.promotions = []
    rowsByTable.products = [
      productRow({ id: PRODUCT_WITH_MANUAL_OFFER, name: 'Oferta manual', has_offer: true, offer_price: 70_000 }),
    ]

    const offers = await getStorefrontOffers('default')

    expect(offers).toHaveLength(1)
    expect(offers[0].id).toBe(PRODUCT_WITH_MANUAL_OFFER)
    expect(offers[0].offer_price).toBe(70_000)
    expect(orFilterArg()).toBe('has_offer.eq.true')
  })

  it('no devuelve nada si la organización tiene el marketplace apagado', async () => {
    rowsByTable.organizations = [{
      id: 'org-1',
      name: 'Tienda',
      slug: 'default',
      plan: null,
      logo_url: null,
      marketplace_public: false,
    }]

    await expect(getStorefrontOffers('default')).resolves.toEqual([])
  })
})
