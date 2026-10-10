import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileAppointments } from '@/components/profile/profile-appointments'
import { splitCustomerAppointments, type CustomerAppointment } from '@/lib/agenda/customer-appointments'

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
    expect(page).toContain('organizationId && servicesAvailable')
    const client = readFileSync(resolve(process.cwd(), 'src/app/(public)/perfil/profile-client.tsx'), 'utf8')
    expect(client).toContain('{storeFeatures.services && appointments && (')
  })
})
