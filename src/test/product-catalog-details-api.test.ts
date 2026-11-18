import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const ctx = vi.hoisted(() => ({ owns: true, missing: false, writes: vi.fn(), filters: [] as Array<[string, unknown]> }))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_options: unknown, handler: (req: NextRequest, context: { organization: { id: string } }) => Promise<Response>) => (req: NextRequest) => handler(req, { organization: { id: 'org' } }) }))
vi.mock('@/lib/http/app-origin', () => ({ getBrowserRequestOrigin: (req: NextRequest) => req.nextUrl.origin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => { const q = { select: () => q, eq: (key: string, val: unknown) => { ctx.filters.push([key, val]); return q }, maybeSingle: async () => ({ data: ctx.owns ? { id: '11111111-1111-4111-8111-111111111111' } : null, error: null }) }; return q } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: () => { const result = () => ({ data: { details: { skin_type: 'Mixta' } }, error: ctx.missing ? { code: '42P01' } : null }); const q = { select: () => q, eq: (key: string, val: unknown) => { ctx.filters.push([key, val]); return q }, maybeSingle: async () => result(), limit: async () => result(), upsert: async (...args: unknown[]) => { ctx.writes(...args); return result() } }; return q } }) }))
import { GET, PUT } from '@/app/api/products/catalog-details/route'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { ctx.owns = true; ctx.missing = false; ctx.writes.mockReset(); ctx.filters = [] })
it('lee solo características del producto de la empresa activa', async () => {
  const response = await GET(new NextRequest(`https://app.test/api/products/catalog-details?id=${id}`))
  expect(await response.json()).toMatchObject({ available: true, details: { skin_type: 'Mixta' } })
  expect(ctx.filters).toContainEqual(['organization_id', 'org'])
})
it('no escribe en un producto de otra empresa', async () => {
  ctx.owns = false
  const response = await PUT(new NextRequest('https://app.test/api/products/catalog-details', { method: 'PUT', body: JSON.stringify({ id, details: { volume: '50 ml' } }) }))
  expect(response.status).toBe(404); expect(ctx.writes).not.toHaveBeenCalled()
})
it('informa la migración pendiente sin afirmar un guardado', async () => {
  ctx.missing = true
  expect(await (await GET(new NextRequest('https://app.test/api/products/catalog-details'))).json()).toMatchObject({ available: false })
  const response = await PUT(new NextRequest('https://app.test/api/products/catalog-details', { method: 'PUT', body: JSON.stringify({ id, details: { volume: '50 ml' } }) }))
  expect(response.status).toBe(503)
})
it('rechaza otro origen antes de escribir', async () => {
  const response = await PUT(new NextRequest('https://app.test/api/products/catalog-details', { method: 'PUT', headers: { origin: 'https://otro.test' }, body: JSON.stringify({ id, details: {} }) }))
  expect(response.status).toBe(403); expect(ctx.writes).not.toHaveBeenCalled()
})
it('rechaza PAO fraccionario y no persiste claves desconocidas', async () => {
  expect((await PUT(new NextRequest('https://app.test/api/products/catalog-details', { method: 'PUT', body: JSON.stringify({ id, details: { pao_months: 2.5 } }) }))).status).toBe(400)
  const response = await PUT(new NextRequest('https://app.test/api/products/catalog-details', { method: 'PUT', body: JSON.stringify({ id, details: { skin_type: 'Mixta', organization_id: 'otra' } }) }))
  expect(response.status).toBe(200)
  expect(ctx.writes).toHaveBeenCalledWith(expect.objectContaining({ organization_id: 'org', details: { skin_type: 'Mixta' } }), expect.anything())
})
