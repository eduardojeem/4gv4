import { describe, expect, it, vi } from 'vitest'
import type { PublicAgenda } from '@/lib/agenda/public-agenda-server'
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))
vi.mock('@/lib/saas/public-tenant', () => ({ resolvePublicStorefrontOrganizationBySlug: vi.fn() }))
vi.mock('@/lib/saas/organization-module-check', () => ({ isOrganizationModuleEnabled: vi.fn() }))
import { publicSlotsFor } from '@/lib/agenda/public-agenda-server'

const date = '2026-10-10'
const makeAgenda = (visible = true): PublicAgenda => {
  const admin = { from: () => {
    const q = { select: () => q, eq: () => q, in: () => q, lt: () => q, gt: () => q, neq: () => q,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) }
    return q
  } }
  return { admin, organization: { id: 'org' }, config: {
    capabilities: { professionalBooking: true }, professionalCount: 1,
    settings: { professional_selection: 'optional', max_days_ahead: 180, min_notice_minutes: 0, slot_minutes: 30,
      opening_hours: { 6: [['08:00','12:00']] } },
    timeZone: 'UTC', professionals: [{ id: 'p', sort_order: 0, is_active: true, online_visible: visible, opening_hours: { 6: [['09:00','10:00']] } }],
    services: [{ product_id: 's', online: true, price: 30000, duration_minutes: 30, buffer_minutes: 0 }],
    professionalRates: [{ professional_id: 'p', product_id: 's', price: 40000, duration_minutes: 45, buffer_minutes: 5 }],
  } } as unknown as PublicAgenda
}
describe('public professional availability integration', () => {
  it('uses personal hours and personal duration plus buffer', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-08T00:00:00Z'))
    try {
      const result = await publicSlotsFor(makeAgenda(), date, 's', null)
      expect(result?.slots).toEqual([{ startsAt: '2026-10-10T09:00:00.000Z', endsAt: '2026-10-10T09:45:00.000Z', professionalIds: ['p'] }])
    } finally { vi.restoreAllMocks() }
  })
  it('does not expose a hidden professional or create a null agenda', async () => {
    expect((await publicSlotsFor(makeAgenda(false), date, 's', null))?.slots).toEqual([])
  })
  it('uses the appointment snapshot rather than changed rate duration when moving', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-08T00:00:00Z'))
    try {
      const result = await publicSlotsFor(makeAgenda(),date,'s','p','existing',{price:35000,durationMinutes:30,bufferMinutes:0})
      expect(result?.slots).toHaveLength(2)
      expect(result?.slots[0].endsAt).toBe('2026-10-10T09:30:00.000Z')
    } finally { vi.restoreAllMocks() }
  })
})
