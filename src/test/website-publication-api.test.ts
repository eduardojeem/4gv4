import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const state = vi.hoisted(() => ({
  current: { slug: 'mi-tienda', marketplace_public: false, storefront_public: false },
  updates: [] as Array<Record<string, unknown>>,
  settingsError: false,
}))
vi.mock('@/lib/api/withAdminAuth', () => ({
  withAdminAuth: (handler: (request: NextRequest, context: unknown) => unknown) =>
    (request: NextRequest) => handler(request, { user: { id: 'user-1' }, organizationId: 'org-1' }),
}))
vi.mock('@/lib/website/admin-organization', () => ({ resolveWebsiteAdminOrganizationId: async () => 'org-1' }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      let otherOrganization = false
      let updating = false
      const query = {
        select: () => query, eq: () => query,
        neq: () => { otherOrganization = true; return query },
        update: (data: Record<string, unknown>) => { updating = true; if (table === 'organizations') state.updates.push(data); return query },
        upsert: () => { updating = true; return query },
        maybeSingle: () => query,
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({
          data: table === 'organizations' && !updating && !otherOrganization ? state.current
            : table === 'website_settings' && !updating ? { value: { commerceMode: 'whatsapp' } } : null,
          error: table === 'website_settings' && updating && state.settingsError ? { message: 'simulated write failure' } : null,
        }).then(resolve),
      }
      return query
    },
  }),
}))

import { PUT } from '@/app/api/admin/website/sync-company/route'

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/website/sync-company', {
    method: 'PUT', body: JSON.stringify({ ...getWebsiteSettingsDefaults().company_info,
      name: 'Mi tienda', slug: 'mi-tienda', phone: '0981123456', whatsapp: '595981123456',
      storefrontPublic: true, marketplacePublic: false, ...overrides }),
  })
}
beforeEach(() => { state.updates = []; state.settingsError = false })

describe('publication API safety', () => {
  it('rejects activation without explicit confirmation', async () => {
    expect((await PUT(request())).status).toBe(422)
    expect(state.updates).toHaveLength(0)
  })
  it('checks WhatsApp configuration server-side', async () => {
    expect((await PUT(request({ publicationConfirmed: true, whatsapp: '' }))).status).toBe(422)
    expect(state.updates).toHaveLength(0)
  })
  it('publishes only after company data has been persisted', async () => {
    expect((await PUT(request({ publicationConfirmed: true }))).status).toBe(200)
    expect(state.updates[0]).toMatchObject({ storefront_public: false, marketplace_public: false })
    expect(state.updates.at(-1)).toEqual({ storefront_public: true, marketplace_public: false })
  })
  it('keeps the storefront private when a related write fails', async () => {
    state.settingsError = true
    expect((await PUT(request({ publicationConfirmed: true }))).status).toBe(500)
    expect(state.updates.some(update => update.storefront_public === true)).toBe(false)
  })
})
