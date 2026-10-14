import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ previous: { name: 'Mi tienda' } as Record<string, unknown>, written: {} as Record<string, unknown>, readError: false, writeError: false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/api/withAdminAuth', () => ({
  withAdminAuth: (handler: (request: NextRequest, context: unknown) => unknown) =>
    (request: NextRequest) => handler(request, { user: { id: 'user-1', role: 'admin' }, organizationId: 'org-1' }),
}))
vi.mock('@/lib/website/admin-organization', () => ({ resolveWebsiteAdminOrganizationId: async () => 'org-1' }))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  from: () => {
    let writing = false
    let single = false
    const query = {
      select: () => query, eq: () => query, in: () => query,
      upsert: (rows: { value: Record<string, unknown> } | Array<{ value: Record<string, unknown> }>) => {
        writing = true
        state.written = (Array.isArray(rows) ? rows[0] : rows).value
        return query
      },
      maybeSingle: () => { single = true; return query },
      single: () => { single = true; return query },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: single ? { key: 'company_info', value: writing ? state.written : state.previous }
          : [{ key: 'company_info', value: writing ? state.written : state.previous }],
        error: (writing ? state.writeError : state.readError) ? { message: 'simulated failure' } : null,
      }).then(resolve),
    }
    return query
  },
}) }))

import { revalidatePath, revalidateTag } from 'next/cache'
import { PUT as saveBatch } from '@/app/api/admin/website/settings/route'
import { PUT as saveSingle } from '@/app/api/admin/website/settings/[key]/route'

beforeEach(() => {
  vi.clearAllMocks()
  state.previous = { name: 'Mi tienda' }
  state.readError = state.writeError = false
})

describe.each(['batch', 'single'])('%s website cache invalidation', mode => {
  const save = (name: string) => {
    const request = new NextRequest('http://localhost/api/admin/website/settings', {
      method: 'PUT', body: JSON.stringify(mode === 'batch' ? { values: { company_info: { name } } } : { value: { name } }),
    })
    return mode === 'batch' ? saveBatch(request) : saveSingle(request, { params: Promise.resolve({ key: 'company_info' }) })
  }

  it('persists an unchanged setting without invalidating public pages', async () => {
    expect((await save('Mi tienda')).status).toBe(200)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refreshes changed settings without purging the marketplace layout', async () => {
    expect((await save('Nuevo nombre')).status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('marketplace:organizations', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/marketplace')
    expect(revalidatePath).not.toHaveBeenCalledWith('/marketplace', 'layout')
  })

  it('does not invalidate when persistence fails', async () => {
    state.writeError = true
    expect((await save('Nuevo nombre')).status).toBe(500)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
