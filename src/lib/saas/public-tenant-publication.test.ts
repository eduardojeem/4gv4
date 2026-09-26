import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublicStorefrontEnabled, resolvePublicOrganizationBySlug } from './public-tenant'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
const client = { from: vi.fn(() => query) } as unknown as SupabaseClient

beforeEach(() => {
  vi.clearAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
})

describe('public tenant publication boundary', () => {
  it('fails closed for a missing or unpublished organization', () => {
    expect(isPublicStorefrontEnabled(null)).toBe(false)
    expect(isPublicStorefrontEnabled({ storefront_public: false })).toBe(false)
  })
  it('allows a published direct storefront outside the marketplace', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { id: 'org-a', storefront_public: true, marketplace_public: false }, error: null })
    expect(await resolvePublicOrganizationBySlug('tienda-a', client)).toMatchObject({ id: 'org-a' })
    expect(query.eq).toHaveBeenCalledWith('slug', 'tienda-a')
  })
  it('denies direct access even if marketplace was enabled by another writer', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { id: 'org-a', storefront_public: false, marketplace_public: true }, error: null })
    expect(await resolvePublicOrganizationBySlug('tienda-a', client)).toBeNull()
  })
  it('does not allow aliases to bypass publication', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { organization: { id: 'org-a', storefront_public: false } }, error: null })
    expect(await resolvePublicOrganizationBySlug('old-slug', client)).toBeNull()
  })
  it('does not silently publish on database errors', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('unavailable') })
    await expect(resolvePublicOrganizationBySlug('tienda-a', client)).rejects.toThrow('unavailable')
  })
})
