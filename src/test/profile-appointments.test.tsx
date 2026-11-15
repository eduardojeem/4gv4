import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileAppointments } from '@/components/profile/profile-appointments'
import { loadCustomerAppointmentsAcrossStores, splitCustomerAppointments, type CustomerAppointment } from '@/lib/agenda/customer-appointments'
import type { SupabaseClient } from '@supabase/supabase-js'

const turno = (patch: Partial<CustomerAppointment>): CustomerAppointment => ({
  id: Math.random().toString(36).slice(2),
  serviceName: 'Corte clásico',
  startsAt: '2026-10-12T13:00:00Z',
  endsAt: '2026-10-12T13:30:00Z',
  status: 'confirmed',
  price: 50000,
  professionalName: 'Juan',
  token: '11111111-2222-4333-8444-555555555555',
  ...patch,
})
const now = new Date('2026-10-10T12:00:00Z')

describe('Mis turnos', () => {
  it('próximos: por confirmar o confirmados que no terminaron, del más cercano al más lejano', () => {
    const rows = [
      turno({ id: 'lejos', startsAt: '2026-10-20T13:00:00Z', endsAt: '2026-10-20T13:30:00Z' }),
      turno({ id: 'cerca', status: 'pending' }),
      turno({ id: 'cancelado', status: 'cancelled' }),
      turno({ id: 'viejo', startsAt: '2026-10-01T13:00:00Z', endsAt: '2026-10-01T13:30:00Z' }),
    ]
    const { upcoming, past } = splitCustomerAppointments(rows, now)
    expect(upcoming.map((row) => row.id)).toEqual(['cerca', 'lejos'])
    expect(past.map((row) => row.id).sort()).toEqual(['cancelado', 'viejo'])
  })

  it('muestra el turno con quién atiende y el enlace para cambiarlo o cancelarlo', () => {
    render(<ProfileAppointments appointments={{ upcoming: [turno({})], past: [], timeZone: 'America/Asuncion' }} bookingHref="/barber/turnos" />)
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver, cambiar o cancelar el turno de Corte clásico' })).toHaveAttribute('href', '/turno/11111111-2222-4333-8444-555555555555')
    expect(screen.getByRole('link', { name: /Reservar turno/ })).toHaveAttribute('href', '/barber/turnos')
  })

  it('sin turnos explica qué va a aparecer', () => {
    render(<ProfileAppointments appointments={{ upcoming: [], past: [], timeZone: 'America/Asuncion' }} bookingHref="/b/turnos" />)
    expect(screen.getByText(/Cuando reserves, tus turnos aparecen acá/)).toBeInTheDocument()
  })

  it('el perfil los carga solo en tiendas que toman turnos', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/(public)/perfil/page.tsx'), 'utf8')
    expect(page).toContain("appointmentsScope={organizationId ? (servicesAvailable ? 'store' : null) : 'marketplace'}")
    const client = readFileSync(resolve(process.cwd(), 'src/app/(public)/perfil/profile-client.tsx'), 'utf8')
    expect(client).toContain("{appointmentsScope === 'store' && appointments && (")
    expect(client).toContain('<ProfileAppointments appointments={appointments} title="Mis reservas" />')
  })
})

describe('Mis reservas del marketplace', () => {
  it('muestra la tienda de cada turno y no ofrece reservar sin una tienda', () => {
    render(<ProfileAppointments title="Mis reservas" appointments={{ timeZone: 'America/Asuncion', past: [], upcoming: [turno({ store: { name: 'JuanBarber', slug: 'juanbarber', timeZone: 'America/Asuncion' } })] }} />)
    expect(screen.getByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'JuanBarber' })).toHaveAttribute('href', '/juanbarber/inicio')
    expect(screen.queryByRole('link', { name: /Reservar turno/ })).not.toBeInTheDocument()
  })

  it('junta los turnos de las fichas vinculadas a la cuenta en todas las tiendas', async () => {
    const calls: Array<[string, string, unknown]> = []
    const tables: Record<string, unknown[]> = {
      customers: [{ id: 'c1', organization_id: 'o1' }, { id: 'c2', organization_id: 'o2' }],
      appointments: [
        { id: 'a1', organization_id: 'o1', service_name: 'Corte', starts_at: '2099-01-01T12:00:00Z', ends_at: '2099-01-01T12:30:00Z', status: 'confirmed', price: 45000, public_token: 't1', agenda_professionals: { name: 'Juan' } },
        { id: 'a2', organization_id: 'o2', service_name: 'Uñas', starts_at: '2020-01-01T12:00:00Z', ends_at: '2020-01-01T13:00:00Z', status: 'completed', price: 80000, public_token: 't2', agenda_professionals: null },
      ],
      organizations: [{ id: 'o1', name: 'JuanBarber', slug: 'juanbarber' }, { id: 'o2', name: 'Nails', slug: 'nails' }],
      organization_settings: [{ organization_id: 'o2', timezone: 'America/Sao_Paulo' }],
    }
    const admin = {
      from: (table: string) => {
        const q: Record<string, unknown> = {}
        const result = () => Promise.resolve({ data: tables[table], error: null })
        for (const method of ['select', 'order', 'limit']) q[method] = () => q
        q.eq = (column: string, value: unknown) => { calls.push([table, column, value]); return q }
        q.in = (column: string, value: unknown) => { calls.push([table, column, value]); return q }
        q.then = (resolve: (value: unknown) => unknown) => result().then(resolve)
        return q
      },
    } as unknown as SupabaseClient
    const result = await loadCustomerAppointmentsAcrossStores(admin, 'user-1')
    expect(calls).toContainEqual(['customers', 'profile_id', 'user-1'])
    expect(calls).toContainEqual(['appointments', 'customer_id', ['c1', 'c2']])
    expect(result.upcoming.map((row) => [row.serviceName, row.store?.name])).toEqual([['Corte', 'JuanBarber']])
    expect(result.past.map((row) => [row.serviceName, row.store?.timeZone])).toEqual([['Uñas', 'America/Sao_Paulo']])
  })
})
