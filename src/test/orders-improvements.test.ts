// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner',
  orgRole: 'owner',
  organizationId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
  otherBranchId: '22222222-2222-4222-8222-222222222223',
  effectiveModules: ['orders', 'delivery', 'pos'],
  accessibleBranches: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Sucursal 1' }],
  branchScopeError: null as string | null,
  paymentControlError: null as { message: string; code: string; status: number } | null,
  ordersRows: [] as Array<Record<string, unknown>>,
  currentOrder: null as Record<string, unknown> | null,
  statusCounts: {} as Record<string, number>,
  todayCount: 3,
  todayPaidRows: [] as Array<{ amount: number; order_id: string | null }>,
  updatedPayloads: [] as Array<{ table: string; payload: Record<string, unknown>; id?: string }>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcErrors: new Map<string, { message: string }>(),
  recordedFilters: [] as Array<{ table: string; op: string; col?: string; val?: unknown }>,
  sendEmail: vi.fn(async () => undefined),
  dispatchNotification: vi.fn(async () => ({})),
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
    (request: NextRequest, routeContext?: unknown) =>
      handler(
        request,
        {
          user: { id: state.userId, role: state.userRole, email: 'user@tienda.test' },
          organization: {
            id: state.organizationId,
            name: 'MiTienda Test',
            slug: 'mitienda-test',
            role: state.orgRole,
          },
        },
        routeContext
      ),
}))

vi.mock('@/lib/payments/control-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/control-contract')>()
  return {
    ...actual,
    assertCommercePayments: vi.fn(async () => {
      if (state.paymentControlError) {
        const err = new Error(state.paymentControlError.message) as Error & { code: string; status: number }
        err.name = 'PaymentControlError'
        err.code = state.paymentControlError.code
        err.status = state.paymentControlError.status
        Object.setPrototypeOf(err, (await import('@/lib/payments/control-contract')).PaymentControlError.prototype)
        throw err
      }
    }),
  }
})

vi.mock('@/lib/saas/subscription-service', () => ({
  getOrganizationPlanInfo: vi.fn(async () => ({
    effectiveModules: state.effectiveModules,
  })),
}))

vi.mock('@/lib/branches/server', () => ({
  getRequestedBranchId: vi.fn((req: NextRequest, bodyBranchId?: string | null) =>
    req.headers.get('x-branch-id') || bodyBranchId || state.branchId
  ),
  listAccessibleBranchesForUser: vi.fn(async () => state.accessibleBranches),
  resolveBranchScopeForUser: vi.fn(async ({ requestedBranchId }: { requestedBranchId?: string | null }) => {
    if (state.branchScopeError) {
      throw new Error(state.branchScopeError)
    }
    return { branchId: requestedBranchId ?? state.branchId }
  }),
}))

vi.mock('@/lib/branches/inventory', () => ({
  loadBranchInventoryStockMap: vi.fn(async () => ({
    stockMap: new Map(),
    branchScoped: true,
    failed: false,
  })),
}))

vi.mock('@/lib/products/variant-branch-stock', () => ({
  loadVariantBranchStock: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/email/resend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/resend')>()
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => (state.sendEmail as (...a: unknown[]) => Promise<void>)(...args),
  }
})

vi.mock('@/lib/notifications/server/dispatcher', () => ({
  dispatchNotificationEvent: (...args: unknown[]) =>
    (state.dispatchNotification as (...a: unknown[]) => Promise<Record<string, unknown>>)(...args),
}))

function buildSupabaseQuery(table: string) {
  const filters: Array<{ op: string; col?: string; val?: unknown }> = []
  let selectCols = '*'
  let selectHead = false
  let pendingUpdate: Record<string, unknown> | null = null

  const record = (op: string, col?: string, val?: unknown) => {
    const entry = { table, op, col, val }
    filters.push({ op, col, val })
    state.recordedFilters.push(entry)
  }

  const filterOrders = () => {
    let rows = [...state.ordersRows]
    for (const f of filters) {
      if (f.op === 'eq' && f.col === 'id') {
        rows = rows.filter((r) => r.id === f.val)
      }
      if (f.op === 'eq' && f.col === 'branch_id') {
        rows = rows.filter((r) => r.branch_id === f.val)
      }
      if (f.op === 'is' && f.col === 'branch_id' && f.val === null) {
        rows = rows.filter((r) => r.branch_id === null || r.branch_id === undefined)
      }
      if (f.op === 'in' && f.col === 'id' && Array.isArray(f.val)) {
        const set = new Set(f.val)
        rows = rows.filter((r) => set.has(r.id))
      }
      if (f.op === 'in' && f.col === 'status' && Array.isArray(f.val)) {
        const set = new Set(f.val)
        rows = rows.filter((r) => set.has(r.status))
      }
      if (f.op === 'eq' && f.col === 'fulfillment_type') {
        rows = rows.filter((r) => r.fulfillment_type === f.val)
      }
      if (f.op === 'or' && typeof f.val === 'string' && f.val.includes('branch_id.is.null')) {
        const m = f.val.match(/branch_id\.in\.\(([^)]+)\)/)
        const allowed = new Set(m ? m[1].split(',') : [])
        rows = rows.filter((r) => r.branch_id == null || allowed.has(String(r.branch_id)))
      }
    }
    return rows
  }

  const builder = {
    select: (cols = '*', opts?: { count?: string; head?: boolean }) => {
      selectCols = cols
      selectHead = Boolean(opts?.head)
      return builder
    },
    insert: async (payload: Record<string, unknown>) => {
      state.updatedPayloads.push({ table, payload })
      return { data: payload, error: null }
    },
    update: (payload: Record<string, unknown>) => {
      pendingUpdate = payload
      state.updatedPayloads.push({ table, payload })
      return builder
    },
    eq: (col: string, val: unknown) => {
      record('eq', col, val)
      return builder
    },
    in: (col: string, val: unknown[]) => {
      record('in', col, val)
      return builder
    },
    is: (col: string, val: unknown) => {
      record('is', col, val)
      return builder
    },
    or: (val: string) => {
      record('or', undefined, val)
      return builder
    },
    ilike: (col: string, val: unknown) => {
      record('ilike', col, val)
      return builder
    },
    gte: (col: string, val: unknown) => {
      record('gte', col, val)
      return builder
    },
    gt: (col: string, val: unknown) => {
      record('gt', col, val)
      return builder
    },
    order: () => builder,
    range: async () => {
      if (table === 'customer_orders') {
        const rows = filterOrders()
        return { data: rows, error: null, count: rows.length }
      }
      return { data: [], error: null, count: 0 }
    },
    maybeSingle: async () => {
      if (table === 'organization_settings') {
        return { data: { timezone: 'America/Asuncion' }, error: null }
      }
      if (table === 'customer_orders') {
        if (state.currentOrder) return { data: state.currentOrder, error: null }
        const rows = filterOrders()
        return { data: rows[0] ?? null, error: null }
      }
      return { data: null, error: null }
    },
    single: async () => {
      if (table === 'customer_orders') {
        const idEq = filters.find((f) => f.op === 'eq' && f.col === 'id')?.val
        const row =
          (idEq ? state.ordersRows.find((r) => r.id === idEq) : null)
          ?? state.currentOrder
          ?? state.ordersRows[0]
          ?? null
        if (pendingUpdate && row) {
          return { data: { ...row, ...pendingUpdate }, error: null }
        }
        return { data: row, error: null }
      }
      return { data: null, error: null }
    },
    then: (resolve: (value: { data: unknown; error: null; count?: number }) => void) => {
      if (table === 'customer_orders') {
        if (selectHead) {
          const isTodayQuery = filters.some((f) => f.op === 'gte' && f.col === 'created_at')
          if (isTodayQuery) {
            resolve({ data: null, error: null, count: state.todayCount })
            return
          }
          const rows = filterOrders()
          resolve({ data: null, error: null, count: rows.length })
          return
        }
        const rows = filterOrders()
        if (selectCols === 'id') {
          resolve({ data: rows.map((r) => ({ id: r.id })), error: null })
          return
        }
        resolve({ data: rows, error: null, count: rows.length })
        return
      }
      if (table === 'customer_order_payment_history') {
        resolve({ data: state.todayPaidRows, error: null })
        return
      }
      resolve({ data: [], error: null })
    },
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => buildSupabaseQuery(table),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => buildSupabaseQuery(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      const err = state.rpcErrors.get(fn) ?? null
      return { data: err ? null : { ok: true }, error: err }
    },
  }),
}))

import { GET as getOrders } from '@/app/api/orders/route'
import { PUT as updateOrderRoute } from '@/app/api/orders/[id]/route'
import { PATCH as patchOrderStatus } from '@/app/api/orders/[id]/status/route'
import { PATCH as bulkUpdateOrders } from '@/app/api/orders/bulk-status/route'
import { formatNotificationContent } from '@/lib/notifications/server/content'
import { renderOrderStatusUpdateEmail } from '@/lib/email/templates'
import { normalizeOrder } from '@/lib/orders/helpers'
import {
  buildOrderWhatsAppUrl,
  collectOrderPayment,
  fetchOrders,
  orderSummaryText,
  orderWhatsAppMessage,
  stripDuplicateVariantSuffix,
  updateOrder as mobileUpdateOrder,
} from '../../mobile/src/lib/pos'
import {
  setPrivateCacheBranch,
  setPrivateCacheOrganization,
  setPrivateCacheUser,
} from '../../mobile/src/lib/private-cache-context'

const ORDER_1 = '99999999-9999-4999-8999-999999999901'
const ORDER_2 = '99999999-9999-4999-8999-999999999902'
const ORDER_3 = '99999999-9999-4999-8999-999999999903'
const ORDER_MISSING = '99999999-9999-4999-8999-999999999999'

function makeDbOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_1,
    organization_id: state.organizationId,
    branch_id: state.branchId,
    customer_id: '33333333-3333-4333-8333-333333333333',
    created_by: null,
    order_number: 'PED-1001',
    status: 'PENDING',
    payment_status: 'PENDING',
    payment_method: 'CASH',
    fulfillment_type: 'PICKUP',
    customer_name: 'Ana Pérez',
    customer_email: 'ana@cliente.test',
    customer_phone: '0981111222',
    customer_address: null,
    subtotal: 100000,
    tax_amount: 0,
    shipping_cost: 0,
    discount_amount: 0,
    total: 100000,
    collected_amount: 0,
    store_credit_reserved: 0,
    store_credit_applied: 0,
    stock_reserved: true,
    notes: null,
    order_items: [
      {
        id: 'item-1',
        product_id: '44444444-4444-4444-8444-444444444444',
        product_name: 'Remera Club (M / Negro)',
        product_sku: 'REM-M',
        variant_name: 'M / Negro',
        quantity: 2,
        unit_price: 50000,
        subtotal: 100000,
      },
    ],
    created_at: '2026-11-10T10:00:00Z',
    updated_at: '2026-11-10T10:00:00Z',
    ...overrides,
  }
}

describe('orders audit improvements across backend, notifications and mobile', () => {
  beforeEach(() => {
    state.userId = 'user-1'
    state.userRole = 'owner'
    state.orgRole = 'owner'
    state.effectiveModules = ['orders', 'delivery', 'pos']
    state.accessibleBranches = [{ id: state.branchId, name: 'Sucursal 1' }]
    state.branchScopeError = null
    state.paymentControlError = null
    state.ordersRows = []
    state.currentOrder = null
    state.todayCount = 2
    state.todayPaidRows = []
    state.updatedPayloads = []
    state.rpcCalls = []
    state.rpcErrors = new Map()
    state.recordedFilters = []
    state.sendEmail.mockClear()
    state.dispatchNotification.mockClear()

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

  it('derives channel correctly in normalizeOrder and deduplicates variant suffixes', () => {
    const webOrder = normalizeOrder(makeDbOrder({ created_by: null, branch_id: null }))
    expect(webOrder.channel).toBe('WEB')
    expect(webOrder.branch_id).toBeNull()

    const panelOrder = normalizeOrder(makeDbOrder({ created_by: 'staff-1', branch_id: state.branchId }))
    expect(panelOrder.channel).toBe('PANEL')
    expect(panelOrder.branch_id).toBe(state.branchId)

    expect(stripDuplicateVariantSuffix('Remera Club (M / Negro)', 'M / Negro')).toBe('Remera Club')
    expect(stripDuplicateVariantSuffix('Remera Club', 'M / Negro')).toBe('Remera Club')
  })

  describe('GET /api/orders branch filtering, fulfillment filter and PARTIAL/PAID revenue', () => {
    it('filters by branch_id UUID, scopes non-admin staff to accessible branches + web orders, and sums PAID + PARTIAL todayRevenue', async () => {
      state.ordersRows = [
        makeDbOrder({ id: ORDER_1, branch_id: state.branchId, fulfillment_type: 'DELIVERY' }),
        makeDbOrder({ id: ORDER_2, branch_id: state.otherBranchId, fulfillment_type: 'PICKUP' }),
        makeDbOrder({ id: ORDER_3, branch_id: null, fulfillment_type: 'DELIVERY' }),
      ]
      state.todayPaidRows = [
        { amount: 50000, order_id: ORDER_1 },
        { amount: 25000, order_id: ORDER_1 }, // PARTIAL collection
        { amount: 90000, order_id: ORDER_2 }, // excluded when filtered to branch 1
        { amount: 15000, order_id: ORDER_3 }, // storefront order with branch_id null
      ]

      // 1. Admin filtering specific branch + fulfillment + include_stats
      const branchRes = await getOrders(
        new NextRequest(`http://localhost/api/orders?branch_id=${state.branchId}&fulfillment_type=DELIVERY&include_stats=true`)
      )
      expect(branchRes.status).toBe(200)
      const branchJson = await branchRes.json()
      expect(branchJson.data.orders.map((o: { id: string }) => o.id)).toEqual([ORDER_1])
      expect(branchJson.data.meta.todayRevenue).toBe(75000)

      // 2. Non-admin staff with branch_id=ALL still includes storefront null-branch orders + accessible branches
      state.orgRole = 'manager'
      state.userRole = 'manager'
      const staffRes = await getOrders(
        new NextRequest('http://localhost/api/orders?branch_id=ALL&include_stats=true')
      )
      expect(staffRes.status).toBe(200)
      const staffJson = await staffRes.json()
      expect(staffJson.data.orders.map((o: { id: string }) => o.id)).toEqual([ORDER_1, ORDER_3])
      expect(staffJson.data.meta.todayRevenue).toBe(90000)

      // 3. Malformed branch_id -> 400
      const badBranchRes = await getOrders(new NextRequest('http://localhost/api/orders?branch_id=not-a-uuid'))
      expect(badBranchRes.status).toBe(400)

      // 4. Unauthorized branch -> 403
      state.branchScopeError = 'No tenés acceso a esta sucursal.'
      const forbiddenRes = await getOrders(new NextRequest(`http://localhost/api/orders?branch_id=${state.otherBranchId}`))
      expect(forbiddenRes.status).toBe(403)
    })
  })

  describe('PUT /api/orders/[id] validation, payment controls and financial lock', () => {
    it('enforces payment controls, validates merged delivery contact & amounts, auto-zeroes pickup shipping, and locks paid orders', async () => {
      // 1. Payment control disabled -> PaymentControlError status
      state.paymentControlError = { message: 'Transferencia deshabilitada', code: 'PAYMENT_DISABLED', status: 403 }
      const blockedRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payment_method: 'TRANSFER' }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(blockedRes.status).toBe(403)
      state.paymentControlError = null

      // 2. Switching DELIVERY without phone/address fails validation
      state.currentOrder = makeDbOrder({
        id: ORDER_1,
        fulfillment_type: 'PICKUP',
        customer_phone: null,
        customer_address: null,
      })
      const badDeliveryRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fulfillment_type: 'DELIVERY' }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(badDeliveryRes.status).toBe(400)

      // 3. Discount > subtotal fails validation
      const badDiscountRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ discount_amount: 999999 }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(badDiscountRes.status).toBe(400)

      // 4. Switching unlocked DELIVERY -> PICKUP without shipping_cost auto-zeroes shipping_cost & recomputes total
      state.currentOrder = makeDbOrder({
        id: ORDER_1,
        fulfillment_type: 'DELIVERY',
        customer_phone: '0981111222',
        customer_address: 'Av. España 123',
        subtotal: 100000,
        shipping_cost: 15000,
        discount_amount: 5000,
        total: 110000,
      })
      const pickupSwitchRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fulfillment_type: 'PICKUP', customer_email: '   ' }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(pickupSwitchRes.status).toBe(200)
      const pickupPayload = state.updatedPayloads.at(-1)?.payload
      expect(pickupPayload).toMatchObject({
        fulfillment_type: 'PICKUP',
        shipping_cost: 0,
        total: 95000,
        customer_email: null,
      })

      // 5. Financial edit on PAID order returns 409, while non-financial update succeeds
      state.currentOrder = makeDbOrder({ id: ORDER_1, payment_status: 'PAID', shipping_cost: 10000 })
      const lockedRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ discount_amount: 1000 }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(lockedRes.status).toBe(409)
      expect((await lockedRes.json()).code).toBe('ORDER_FINANCIAL_EDIT_LOCKED')

      const notesOnPaidRes = await updateOrderRoute(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notes: 'Tocar timbre 2' }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(notesOnPaidRes.status).toBe(200)
    })
  })

  describe('PATCH /api/orders/bulk-status & status side effects', () => {
    it('updates valid transitions, reports skipped items cleanly, and fires notifications + customer emails', async () => {
      state.orgRole = 'manager'
      state.userRole = 'manager'
      state.accessibleBranches = [{ id: state.branchId, name: 'Sucursal 1' }]
      state.ordersRows = [
        makeDbOrder({ id: ORDER_1, order_number: 'PED-1', status: 'PENDING', branch_id: state.branchId, customer_email: 'uno@test.py' }),
        makeDbOrder({ id: ORDER_2, order_number: 'PED-2', status: 'DELIVERED', branch_id: state.branchId }), // invalid transition
        makeDbOrder({ id: ORDER_3, order_number: 'PED-3', status: 'PENDING', branch_id: state.otherBranchId }), // branch denied
      ]

      const res = await bulkUpdateOrders(
        new NextRequest('http://localhost/api/orders/bulk-status', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ids: [ORDER_1, ORDER_2, ORDER_3, ORDER_MISSING],
            status: 'CONFIRMED',
            note: 'Aprobado en lote',
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.updated).toHaveLength(1)
      expect(json.data.updated[0].id).toBe(ORDER_1)
      expect(json.data.skipped).toHaveLength(3)
      expect(json.data.skipped.map((s: { reason: string }) => s.reason)).toEqual([
        'No puede pasar de Entregado a Confirmado.',
        'Sin acceso a la sucursal del pedido.',
        'Pedido no encontrado.',
      ])
      expect(state.rpcCalls[0]).toMatchObject({
        fn: 'confirm_customer_order_from_pending_atomic',
        args: { p_order_id: ORDER_1, p_note: 'Aprobado en lote' },
      })

      await vi.waitFor(() => {
        expect(state.dispatchNotification).toHaveBeenCalledTimes(1)
        expect(state.sendEmail).toHaveBeenCalledTimes(1)
      })
      expect(state.dispatchNotification.mock.calls[0][0]).toMatchObject({
        type: 'ORDER_CONFIRMED',
        resourceId: ORDER_1,
      })
      expect(state.sendEmail.mock.calls[0][0]).toMatchObject({
        to: 'uno@test.py',
        subject: 'Pedido #PED-1 · Confirmado',
      })
    })

    it('emits ORDER_READY / ORDER_CANCELLED notifications & status update email on single status PATCH, skipping email if missing', async () => {
      state.currentOrder = makeDbOrder({
        id: ORDER_1,
        order_number: 'PED-9',
        status: 'PREPARING',
        fulfillment_type: 'PICKUP',
        customer_email: null,
      })
      state.ordersRows = [state.currentOrder]

      const readyRes = await patchOrderStatus(
        new NextRequest(`http://localhost/api/orders/${ORDER_1}/status`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'READY' }),
        }),
        { params: Promise.resolve({ id: ORDER_1 }) }
      )
      expect(readyRes.status).toBe(200)
      await vi.waitFor(() => {
        expect(state.dispatchNotification).toHaveBeenCalledTimes(1)
      })
      expect(state.dispatchNotification.mock.calls[0][0]).toMatchObject({
        type: 'ORDER_READY',
        resourceId: ORDER_1,
      })
      expect(state.sendEmail).not.toHaveBeenCalled()

      expect(formatNotificationContent('ORDER_CONFIRMED', { orderNumber: 'PED-9', customerName: 'Ana' })).toMatchObject({
        title: 'Pedido confirmado',
        body: 'Pedido #PED-9 de Ana',
      })
      expect(formatNotificationContent('ORDER_READY', { orderNumber: 'PED-9', customerName: 'Ana' })).toMatchObject({
        title: 'Pedido listo',
        body: 'Pedido #PED-9 de Ana',
      })
      expect(formatNotificationContent('ORDER_READY')).toMatchObject({
        title: 'Pedido listo',
        body: 'El pedido está listo para entrega o retiro.',
      })
      expect(formatNotificationContent('ORDER_CANCELLED', { orderNumber: 'PED-9', customerName: 'Ana' })).toMatchObject({
        title: 'Pedido cancelado',
        body: 'Pedido #PED-9 de Ana',
      })

      const html = renderOrderStatusUpdateEmail({
        customerName: 'Ana Pérez',
        orderCode: 'PED-9',
        status: 'READY',
        deliveryMethod: 'pickup',
        total: 100000,
        note: 'Retirar en caja 2',
        trackUrl: 'http://localhost:3000/mitienda/track?orderNumber=PED-9',
        brand: { name: 'MiTienda Test' },
      })
      expect(html).toContain('PED-9')
      expect(html).toContain('Retirar en caja 2')
      expect(html).toContain('listo para retirar')
    })
  })

  describe('mobile/src/lib/pos.ts order enhancements', () => {
    it('sends extended filters in fetchOrders, DIGITAL_WALLET in collectOrderPayment, PUT in updateOrder and rich WhatsApp/share messages', async () => {
      const sampleOrder = normalizeOrder(makeDbOrder({ created_by: 'staff-1', notes: 'Sin bolsa' }))
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('/api/orders?')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { orders: [sampleOrder], pagination: { page: 1, total: 1, totalPages: 1 }, stats: {}, meta: null },
            }),
            { status: 200 }
          )
        }
        return new Response(JSON.stringify({ success: true, data: sampleOrder }), { status: 200 })
      })
      vi.stubGlobal('fetch', fetchMock)

      await fetchOrders({
        status: 'READY',
        search: 'Ana',
        page: 2,
        withStats: true,
        paymentStatus: 'PARTIAL',
        fulfillmentType: 'DELIVERY',
        branchId: state.branchId,
        sort: 'amount_desc',
      })
      const listUrl = String(fetchMock.mock.calls[0]?.[0])
      expect(listUrl).toContain('status=READY')
      expect(listUrl).toContain('payment_status=PARTIAL')
      expect(listUrl).toContain('fulfillment_type=DELIVERY')
      expect(listUrl).toContain(`branch_id=${state.branchId}`)
      expect(listUrl).toContain('sort=amount_desc')

      await collectOrderPayment(
        ORDER_1,
        { amount: 50000, method: 'DIGITAL_WALLET', reference: 'TIGO-123', note: 'Pago parcial' },
        '11111111-1111-4111-8111-111111111111'
      )
      const payInit = fetchMock.mock.calls[1]?.[1]
      expect(payInit?.method).toBe('PATCH')
      expect(JSON.parse(String(payInit?.body))).toMatchObject({
        collectionAmount: 50000,
        paymentMethod: 'DIGITAL_WALLET',
        paymentReference: 'TIGO-123',
        note: 'Pago parcial',
      })

      await mobileUpdateOrder(ORDER_1, { customer_name: 'Ana Editada', notes: 'Nueva nota' })
      const putUrl = String(fetchMock.mock.calls[2]?.[0])
      const putInit = fetchMock.mock.calls[2]?.[1]
      expect(putUrl).toContain(`/api/orders/${ORDER_1}`)
      expect(putInit?.method).toBe('PUT')
      expect(JSON.parse(String(putInit?.body))).toEqual({ customer_name: 'Ana Editada', notes: 'Nueva nota' })

      const waMsg = orderWhatsAppMessage(sampleOrder as never, 'mi-tienda')
      expect(waMsg).toContain('PED-1001')
      expect(waMsg).toContain('http://127.0.0.1:3000/mi-tienda/track?orderNumber=PED-1001')

      const waUrl = buildOrderWhatsAppUrl(sampleOrder as never, 'mi-tienda')
      expect(waUrl).toContain('https://wa.me/595981111222?text=')

      const summary = orderSummaryText(sampleOrder as never, 'Casa Central')
      expect(summary).toContain('Sucursal: Casa Central')
      expect(summary).toContain('2 × Remera Club (M / Negro)')
      expect(summary).not.toContain('Remera Club (M / Negro) (M / Negro)')
    })
  })
})
