import { describe, expect, it } from 'vitest'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Database responses are doubled at the network boundary; normalization stays real.
function database(rows: Record<string, unknown>, errors: Record<string, unknown> = {}) {
  return {
    rpc: async () => ({ data: rows.bookingVersion ?? null, error: errors.bookingVersion ?? null }),
    from(table: string) {
      const result = { data: rows[table] ?? [], error: errors[table] ?? null }
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return query
    },
  } as unknown as SupabaseClient
}

const legacy = {
  agenda_settings: {},
  agenda_professionals: [{ id: 'p1', name: 'Ana', is_active: true, sort_order: 0 }],
  agenda_services: [{ product_id: 's1', duration_minutes: 30, online: true }],
  products: [{ id: 's1', name: 'Corte', sale_price: 30000 }],
  organization_settings: {},
}

describe('professional booking schema compatibility', () => {
  it('does not enable transactional bookings with only the foundation migration', async () => {
    const config = await loadAgendaConfig(database({ ...legacy, agenda_settings: { professional_selection: 'required' } }, {
      bookingVersion: { code: 'PGRST202', message: 'function missing' },
    }), 'org')
    expect(config?.capabilities.professionalBooking).toBe(false)
  })
  it('enables professional booking only after the atomic capability probe', async () => {
      const config = await loadAgendaConfig(database({ ...legacy, agenda_settings: { professional_selection: 'required' }, bookingVersion: 3 }), 'org')
    expect(config?.capabilities.professionalBooking).toBe(true)
  })
  it('keeps advanced writes disabled until accepted internal terms are transactional', async () => {
    const config = await loadAgendaConfig(database({ ...legacy, bookingVersion: 2 }), 'org')
    expect(config?.capabilities.professionalBooking).toBe(false)
  })
    it('keeps advanced writes disabled until snapshot checkout is installed', async () => {
      const config = await loadAgendaConfig(database({ ...legacy, agenda_settings: { professional_selection: 'required' }, bookingVersion: 1 }), 'org')
      expect(config?.capabilities.professionalBooking).toBe(false)
    })
  it('retains legacy bookings with optional selection, inherited hours and zero buffer', async () => {
    const config = await loadAgendaConfig(database(legacy), 'org')
    expect(config?.settings).toMatchObject({ professional_selection: 'optional' })
    expect(config?.professionals[0]).toMatchObject({ online_visible: true, opening_hours: null })
    expect(config?.services[0]).toMatchObject({ buffer_minutes: 0 })
    expect(config?.capabilities.professionalBooking).toBe(false)
  })

  it('does not turn permission errors into an empty bookable agenda', async () => {
    await expect(loadAgendaConfig(database(legacy, {
      agenda_professionals: { code: '42501', message: 'permission denied' },
    }), 'org')).rejects.toThrow('permission denied')
  })
  it('does not treat error wording about the schema cache as a missing migration', async () => {
    await expect(loadAgendaConfig(database(legacy, {
      agenda_professionals: { code: '42501', message: 'permission denied while loading schema cache' },
    }), 'org')).rejects.toThrow('permission denied')
  })
})
