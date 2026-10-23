// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ cost: null as number | null, read: true, write: true, writes: [] as any[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_: any, handler: any) => (r: any, c: any) => handler(r, { organization: { id: 'org' }, user: { id: 'user' } }, c) }))
vi.mock('@/lib/products/cost-access', async importOriginal => ({
  ...await importOriginal<any>(),
  resolveOrganizationProductCostAccess: async () => ({ canReadCost: state.read, canWriteCost: state.write }),
}))
function from(table: string) {
  let operation = 'read'; let payload: any; const filters: any = {}
  const q: any = {
    select: () => q, order: () => q, range: () => q, limit: () => q,
    eq: (k: string, v: any) => { filters[k] = v; return q }, neq: () => q,
    in: () => q,
    insert: (v: any) => { operation = 'insert'; payload = v; return q },
    update: (v: any) => { operation = 'update'; payload = v; return q },
  }
  const result = (single = false) => {
    if (operation !== 'read') {
      state.writes.push({ table, payload, filters })
      if (table === 'product_variants' && 'purchase_price' in payload) state.cost = payload.purchase_price
    }
    const row = table === 'products'
      ? { id: 'product', sale_price: 50, purchase_price: 999, variant_attribute_config: [] }
      : { id: 'variant', product_id: 'product', sku: 'TEST', variant_name: 'Test', purchase_price: state.cost, sale_price: 50, stock_quantity: 0, attributes: {}, product: { sale_price: 50 } }
    const missing = table === 'product_variants' && operation === 'read' && filters.sku
    return { data: single ? (missing ? null : row) : [row], error: null, count: 1 }
  }
  q.single = async () => result(true); q.maybeSingle = async () => result(true)
  q.then = (resolve: any) => Promise.resolve(result()).then(resolve)
  return q
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from }) }))
import { GET, POST, PUT } from './route'
import { GET as detail, PUT as update } from './[id]/route'
const req = (body?: any) => ({ url: 'https://local/api/variants', headers: new Headers(), json: async () => body }) as any
const context = { params: Promise.resolve({ id: 'variant' }) }
beforeEach(() => { state.cost = null; state.read = true; state.write = true; state.writes = [] })

it.each([null, 0, 25])('GET list and detail preserve cost %s even with positive parent cost', async cost => {
  state.cost = cost
  expect((await (await GET(req(), undefined)).json()).data[0].cost_price).toBe(cost)
  expect((await (await detail(req(), context)).json()).data.cost_price).toBe(cost)
})
it.each([null, 0, 25])('POST, PUT and bulk PUT persist and return cost %s', async cost => {
  for (const [handler, body, ctx] of [
    [POST, { product_id: 'product', sku: 'NEW', name: 'New', purchase_price: cost }, undefined],
    [update, { purchase_price: cost }, context],
    [PUT, { variants: [{ id: 'variant', purchase_price: cost }] }, undefined],
  ] as any[]) {
    state.writes = []; state.cost = 99
    const response = await handler(req(body), ctx)
    expect(response.status).toBeLessThan(300)
    expect(state.writes.find(w => w.table === 'product_variants').payload.purchase_price).toBe(cost)
    expect(state.cost).toBe(cost)
    const data = (await response.json()).data
    expect((Array.isArray(data) ? data[0] : data).cost_price).toBe(cost)
  }
})
it('redacts unauthorized reads, preserves omitted/null cost on unauthorized edits, rejects explicit zero writes', async () => {
  state.read = false; state.write = false; state.cost = 25
  expect((await (await detail(req(), context)).json()).data).not.toHaveProperty('cost_price')
  expect((await (await GET(req(), undefined)).json()).data[0]).not.toHaveProperty('cost_price')
  await update(req({ name: 'Rename', purchase_price: null }), context)
  expect(state.writes[0].payload).not.toHaveProperty('purchase_price')
  expect(state.cost).toBe(25)
  expect((await update(req({ purchase_price: 0 }), context)).status).toBe(403)
})
