import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ org: 'org-a', rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: state.rpc }) }))
vi.mock('@/lib/auth/require-auth', () => ({ requireStaff: async () => ({ authenticated: true, user: { id: 'user' } }), getAuthResponse: () => null }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: async () => ({ id: state.org }) }))
vi.mock('@/lib/api/api-route-modules', () => ({ moduleAccessResponse: async () => null }))
import { GET } from './route'

describe('SKU availability uses the active tenant and exact normalization', () => {
  beforeEach(() => { state.org = 'org-a'; state.rpc.mockReset() })
  it('normalizes case/trim and does not accept an organization from the query', async () => {
    state.rpc.mockResolvedValue({ data: [{ id: 'existing' }], error: null })
    const r = await GET(new NextRequest('http://localhost/api/products/check-sku?sku=%20a_B%20&organization_id=foreign'))
    expect(await r.json()).toEqual({ isUnique: false, exists: true })
    expect(state.rpc).toHaveBeenCalledWith('find_product_sku_conflict', { p_organization_id: 'org-a', p_sku: 'a_b', p_exclude_id: null })
  })
  it('permits the SKU when it is absent from the other active organization', async () => {
    state.org = 'org-b'; state.rpc.mockResolvedValue({ data: [], error: null })
    const r = await GET(new NextRequest('http://localhost/api/products/check-sku?sku=ABC'))
    expect((await r.json()).isUnique).toBe(true)
    expect(state.rpc.mock.calls[0][1].p_organization_id).toBe('org-b')
  })
  it('excludes the current product when editing', async () => {
    state.rpc.mockResolvedValue({ data: [], error: null })
    const id = '11111111-1111-4111-8111-111111111111'
    await GET(new NextRequest(`http://localhost/api/products/check-sku?sku=ABC&excludeId=${id}`))
    expect(state.rpc.mock.calls[0][1].p_exclude_id).toBe(id)
  })
  it('rejects blank SKUs without querying', async () => {
    expect((await GET(new NextRequest('http://localhost/api/products/check-sku?sku=%20'))).status).toBe(400)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('does not declare uniqueness on a database error', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    expect((await GET(new NextRequest('http://localhost/api/products/check-sku?sku=ABC'))).status).toBe(500)
  })
})
