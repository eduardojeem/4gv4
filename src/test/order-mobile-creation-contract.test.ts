// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  organizationId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
  customerId: '33333333-3333-4333-8333-333333333333',
  existingOrderByIdem: null as Record<string, unknown> | null,
  customer: null as Record<string, unknown> | null,
  products: [] as Array<Record<string, unknown>>,
  variants: [] as Array<Record<string, unknown>>,
  variantBranchStock: new Map<string, number>(),
  branchInventoryStock: new Map<string, number>(),
  effectiveModules: ['orders', 'delivery', 'pos'],
  atomicResult: { order_id: '99999999-9999-4999-8999-999999999999', customer_id: '33333333-3333-4333-8333-333333333333', replayed: false } as Record<string, unknown>,
  atomicError: null as { message: string } | null,
  fullOrder: null as Record<string, unknown> | null,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  sendEmail: vi.fn(async () => undefined),
  notifyOrderCreated: vi.fn(async () => undefined),
}))

const mobileAuth = vi.hoisted(() => ({
  id: 'user-1',
  token: 'token-1',
  signOut: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('../../mobile/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mobileAuth.getSession,
      signOut: mobileAuth.signOut,
    },
  },
}))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_opts: unknown, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request, {
        user: { id: 'user-1', role: 'owner', email: 'owner@tienda.test' },
        organization: {
          id: state.organizationId,
          name: 'MiTienda Test',
          slug: 'mitienda-test',
        },
      }),
}))

vi.mock('@/lib/payments/control-store', () => ({
  assertCommercePayments: vi.fn(async () => undefined),
}))

vi.mock('@/lib/saas/subscription-service', () => ({
  getOrganizationPlanInfo: vi.fn(async () => ({
    effectiveModules: state.effectiveModules,
  })),
}))

vi.mock('@/lib/branches/server', () => ({
  getRequestedBranchId: vi.fn((req: NextRequest, bodyBranchId?: string | null) =>
    req.headers.get('x-branch-id') || bodyBranchId || state.branchId
  ),
  listAccessibleBranchesForUser: vi.fn(async () => [{ id: state.branchId, name: 'Casa Central' }]),
  resolveBranchScopeForUser: vi.fn(async ({ requestedBranchId }: { requestedBranchId?: string | null }) => ({
    branchId: requestedBranchId ?? state.branchId,
  })),
}))

vi.mock('@/lib/branches/inventory', () => ({
  loadBranchInventoryStockMap: vi.fn(async () => ({
    stockMap: state.branchInventoryStock,
    branchScoped: true,
    failed: false,
  })),
}))

vi.mock('@/lib/products/variant-branch-stock', () => ({
  loadVariantBranchStock: vi.fn(async () => state.variantBranchStock),
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmail: (...args: unknown[]) => (state.sendEmail as (...a: unknown[]) => Promise<void>)(...args),
}))

vi.mock('@/lib/email/templates', () => ({
  renderOrderConfirmationEmail: vi.fn(() => '<html>ok</html>'),
}))

vi.mock('@/lib/notifications/server/business-events', () => ({
  afterResponse: (cb: () => Promise<void> | void) => {
    void cb()
  },
  notifyOrderCreated: (payload: unknown) => state.notifyOrderCreated(payload),
}))

function buildQuery(table: string) {
  const filters: Array<{ op: string; col: string; val: unknown }> = []
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push({ op: 'eq', col, val })
      return builder
    },
    in: (col: string, val: unknown[]) => {
      filters.push({ op: 'in', col, val })
      return builder
    },
    maybeSingle: async () => {
      if (table === 'customer_orders') {
        return { data: state.existingOrderByIdem, error: null }
      }
      if (table === 'customers') {
        return { data: state.customer, error: null }
      }
      return { data: null, error: null }
    },
    single: async () => {
      if (table === 'customer_orders') {
        return { data: state.fullOrder, error: null }
      }
      return { data: null, error: null }
    },
    then: (resolvePromise: (value: { data: unknown; error: null }) => void) => {
      if (table === 'products') {
        const idsFilter = filters.find((f) => f.op === 'in' && f.col === 'id')
        const ids = Array.isArray(idsFilter?.val) ? idsFilter.val : null
        const rows = ids ? state.products.filter((p) => ids.includes(p.id)) : state.products
        resolvePromise({ data: rows, error: null })
        return
      }
      if (table === 'product_variants') {
        const idsFilter = filters.find((f) => f.op === 'in' && f.col === 'product_id')
        const ids = Array.isArray(idsFilter?.val) ? idsFilter.val : null
        const rows = state.variants.filter(
          (v) => v.is_active !== false && (!ids || ids.includes(v.product_id))
        )
        resolvePromise({ data: rows, error: null })
        return
      }
      resolvePromise({ data: [], error: null })
    },
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => buildQuery(table),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => buildQuery(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      return { data: state.atomicResult, error: state.atomicError }
    },
  }),
}))

import { POST } from '@/app/api/orders/route'
import { createOrder, orderItemUnitPrice, searchOrderCatalog } from '../../mobile/src/lib/pos'
import {
  setPrivateCacheBranch,
  setPrivateCacheOrganization,
  setPrivateCacheUser,
} from '../../mobile/src/lib/private-cache-context'

const PRODUCT_ID = '44444444-4444-4444-8444-444444444444'
const VARIANT_ID = '55555555-5555-4555-8555-555555555555'
const SERVICE_ID = '66666666-6666-4666-8666-666666666666'

function makeOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    organization_id: state.organizationId,
    branch_id: state.branchId,
    customer_id: state.customerId,
    order_number: 'PED-20261110-ABCDEF12',
    status: 'PENDING',
    payment_status: 'PENDING',
    payment_method: 'CASH',
    fulfillment_type: 'PICKUP',
    customer_name: 'Ana Pérez',
    customer_email: 'ana@cliente.test',
    customer_phone: '0981111222',
    customer_address: null,
    subtotal: 80000,
    tax_amount: 0,
    shipping_cost: 0,
    discount_amount: 0,
    total: 80000,
    notes: null,
    stock_reserved: true,
    order_items: [],
    created_at: '2026-11-10T20:00:00Z',
    updated_at: '2026-11-10T20:00:00Z',
    ...overrides,
  }
}

describe('mobile & backend order creation contracts', () => {
  beforeEach(() => {
    state.existingOrderByIdem = null
    state.customer = {
      id: state.customerId,
      name: 'Ana Pérez',
      email: 'ana@cliente.test',
      phone: '0981111222',
      address: 'Centro',
    }
    state.products = []
    state.variants = []
    state.variantBranchStock = new Map()
    state.branchInventoryStock = new Map()
    state.effectiveModules = ['orders', 'delivery', 'pos']
    state.atomicResult = {
      order_id: '99999999-9999-4999-8999-999999999999',
      customer_id: state.customerId,
      replayed: false,
    }
    state.atomicError = null
    state.fullOrder = makeOrderRow()
    state.rpcCalls = []
    state.sendEmail.mockClear()
    state.notifyOrderCreated.mockClear()

    setPrivateCacheUser(null)
    setPrivateCacheUser(mobileAuth.id)
    setPrivateCacheOrganization(state.organizationId)
    setPrivateCacheBranch(state.branchId)
    mobileAuth.getSession.mockResolvedValue({
      data: { session: { access_token: mobileAuth.token, user: { id: mobileAuth.id } } },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hardens database RPCs with idempotency, branch variants, service bypass and cancellation consistency', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261112120000_orders_idempotency_variants_services.sql'),
      'utf8'
    )
    const dashboardRoute = readFileSync(
      resolve(process.cwd(), 'src/app/api/mobile/dashboard/route.ts'),
      'utf8'
    )
    const mobileNewOrder = readFileSync(
      resolve(process.cwd(), 'mobile/src/app/panel/orders/new.tsx'),
      'utf8'
    )

    expect(migration).toContain('creation_idempotency_key text')
    expect(migration).toContain('customer_orders_org_creation_idempotency_idx')
    expect(migration).toContain('create_dashboard_order_atomic')
    expect(migration).toContain('p_idempotency_key text DEFAULT NULL')
    expect(migration).toContain('adjust_variant_stock_atomic')
    expect(migration).toContain('branch_variant_inventory')
    expect(migration).toContain("VARIANT_NOT_AVAILABLE")
    expect(migration).toContain("IF order_row.status IN ('CANCELLED', 'CANCELADO')")

    expect(dashboardRoute).toContain("'orders.delivery': planInfo.effectiveModules.includes('delivery')")
    expect(mobileNewOrder).toContain("can('orders.delivery')")
    expect(mobileNewOrder).toContain('usePaymentControls')
    expect(mobileNewOrder).toContain('fetchOrderBranches')
  })

  it('rejects a variant product when variantId is missing and prices proportional variant offers when provided', async () => {
    state.products = [
      {
        id: PRODUCT_ID,
        name: 'Remera Club',
        sku: 'REM-001',
        sale_price: 100000,
        offer_price: 80000,
        has_offer: true,
        stock_quantity: 10,
        unit_measure: 'unidad',
        has_variants: true,
        is_active: true,
        category: { name: 'Indumentaria' },
      },
    ]
    state.variants = [
      {
        id: VARIANT_ID,
        product_id: PRODUCT_ID,
        variant_name: 'M / Negro',
        sku: 'REM-001-MN',
        sale_price: 120000,
        wholesale_price: null,
        stock_quantity: 4,
        is_active: true,
      },
    ]
    state.variantBranchStock = new Map([[VARIANT_ID, 4]])

    // Sin variantId -> 409 VARIANT_REQUIRED
    const missingVariantRes = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-branch-id': state.branchId },
        body: JSON.stringify({
          branchId: state.branchId,
          customerId: state.customerId,
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
          paymentMethod: 'CASH',
          fulfillmentType: 'PICKUP',
        }),
      })
    )
    expect(missingVariantRes.status).toBe(409)
    expect((await missingVariantRes.json()).code).toBe('VARIANT_REQUIRED')

    // Con variantId -> 201 y precio proporcional (120.000 * 0.8 = 96.000)
    const okRes = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-branch-id': state.branchId,
          'x-idempotency-key': 'app-ord-variant-test-1234',
        },
        body: JSON.stringify({
          branchId: state.branchId,
          customerId: state.customerId,
          items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 2 }],
          paymentMethod: 'CASH',
          fulfillmentType: 'PICKUP',
        }),
      })
    )
    expect(okRes.status).toBe(201)
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0].fn).toBe('create_dashboard_order_atomic')
    expect(state.rpcCalls[0].args.p_idempotency_key).toBe('app-ord-variant-test-1234')
    expect(state.rpcCalls[0].args.p_items).toEqual([
      {
        product_id: PRODUCT_ID,
        variant_id: VARIANT_ID,
        variant_name: 'M / Negro',
        product_name: 'Remera Club',
        product_sku: 'REM-001-MN',
        quantity: 2,
        unit_price: 96000,
        subtotal: 192000,
      },
    ])
    expect(state.notifyOrderCreated).toHaveBeenCalledTimes(1)
  })

  it('allows service items without branch stock checks or stock failures', async () => {
    state.products = [
      {
        id: SERVICE_ID,
        name: 'Corte Clásico',
        sku: 'SRV-CORTE',
        sale_price: 50000,
        offer_price: null,
        has_offer: false,
        stock_quantity: 0,
        unit_measure: 'servicio',
        has_variants: false,
        is_active: true,
        category: { name: 'Servicios' },
      },
    ]

    const res = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-branch-id': state.branchId,
          'x-idempotency-key': 'app-ord-service-test-1234',
        },
        body: JSON.stringify({
          branchId: state.branchId,
          customerId: state.customerId,
          items: [{ productId: SERVICE_ID, quantity: 1 }],
          paymentMethod: 'TRANSFER',
          fulfillmentType: 'PICKUP',
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(state.rpcCalls[0].args.p_items).toEqual([
      {
        product_id: SERVICE_ID,
        variant_id: null,
        variant_name: null,
        product_name: 'Corte Clásico',
        product_sku: 'SRV-CORTE',
        quantity: 1,
        unit_price: 50000,
        subtotal: 50000,
      },
    ])
  })

  it('replays an existing idempotent order with 200 without duplicating emails or notifications', async () => {
    state.existingOrderByIdem = makeOrderRow({ order_number: 'PED-REPLAY-1' })

    const res = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-branch-id': state.branchId,
          'x-idempotency-key': 'app-ord-replay-test-1234',
        },
        body: JSON.stringify({
          branchId: state.branchId,
          customerId: state.customerId,
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
          paymentMethod: 'CASH',
          fulfillmentType: 'PICKUP',
        }),
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idempotent).toBe(true)
    expect(body.data.order_number).toBe('PED-REPLAY-1')
    expect(state.rpcCalls).toHaveLength(0)
    expect(state.sendEmail).not.toHaveBeenCalled()
    expect(state.notifyOrderCreated).not.toHaveBeenCalled()
  })

  it('matches backend variant pricing and sends idempotency + branch headers from mobile helpers', async () => {
    expect(
      orderItemUnitPrice(
        { sale_price: 100000, offer_price: 80000, has_offer: true },
        { sale_price: 120000 }
      )
    ).toBe(96000)
    expect(
      orderItemUnitPrice(
        { sale_price: 100000, offer_price: 80000, has_offer: false },
        { sale_price: 120000 }
      )
    ).toBe(120000)

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/products?')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              products: [
                { id: PRODUCT_ID, name: 'Activo', sku: 'A1', sale_price: 1000, stock_quantity: 5, is_active: true },
                { id: 'inactive', name: 'Oculto', sku: 'A2', sale_price: 1000, stock_quantity: 5, is_active: false },
              ],
              total: 2,
              truncated: false,
            },
          }),
          { status: 200 }
        )
      }
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          data: makeOrderRow({ order_number: 'PED-MOB-1' }),
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await searchOrderCatalog({
      query: 'Remera',
      kind: 'part',
      branchId: state.branchId,
    })
    expect(catalog.products.map((p) => p.id)).toEqual([PRODUCT_ID])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('strict_branch_stock=true')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('catalog_kind=part')

    const created = await createOrder(
      {
        branchId: state.branchId,
        customerId: state.customerId,
        items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 2 }],
        paymentMethod: 'CASH',
        fulfillmentType: 'DELIVERY',
        deliveryContact: { phone: '0981111222', address: 'Av. España 100' },
        shippingCost: 10000,
        discountAmount: 0,
      },
      'app-ord-mobile-key-1234'
    )

    expect(created.idempotent).toBe(true)
    expect(created.order.order_number).toBe('PED-MOB-1')
    const orderInit = fetchMock.mock.calls[1]?.[1]
    const orderHeaders = orderInit?.headers as Record<string, string>
    expect(orderHeaders['x-idempotency-key']).toBe('app-ord-mobile-key-1234')
    expect(orderHeaders['x-branch-id']).toBe(state.branchId)
    expect(JSON.parse(String(orderInit?.body))).toMatchObject({
      branchId: state.branchId,
      idempotencyKey: 'app-ord-mobile-key-1234',
      customerId: state.customerId,
      items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 2 }],
      fulfillmentType: 'DELIVERY',
      shippingCost: 10000,
    })
  })
})
