import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { NewServiceDialog } from '@/components/dashboard/agenda/NewServiceDialog'
import { appointmentEventsToNotifications, isAppointmentNotification } from '@/hooks/use-appointment-notifications'
import type { AgendaSettings } from '@/lib/agenda/agenda-server'

const settings = { slot_minutes: 30, opening_hours: {}, online_booking: true, require_confirmation: false, min_notice_minutes: 0, max_days_ahead: 30, booking_message: null, notify_email: true } as AgendaSettings
afterEach(() => vi.unstubAllGlobals())

describe('nuevo servicio desde la agenda', () => {
  // La creación en sí (un solo paso, /api/agenda/services) la prueban service-creation-ui y service-entry.
  it('no deja repetir un servicio que ya existe', () => {
    render(<NewServiceDialog open onOpenChange={vi.fn()} existingNames={['Corte clásico']} savedSettings={settings} defaultDuration={30} currency="PYG" onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'corte clásico ' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '50000' } })
    expect(screen.getByText('Ya tenés un servicio con este nombre.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar servicio' })).toBeDisabled()
  })

  it('la sección Servicios tiene el botón y la lista conserva lo que se está editando', () => {
    const panel = readFileSync(resolve(process.cwd(), 'src/components/dashboard/agenda/AgendaSettingsPanel.tsx'), 'utf8')
    expect(panel).toContain('Nuevo servicio</Button>}')
    expect(panel).toContain('onCreated={refreshKeepingDrafts}')
    expect(panel).toContain('onAdded={refreshKeepingDrafts}')
  })
})

describe('reservas en la campanita general', () => {
  const event = { id: 'e1', kind: 'booked' as const, customer_name: 'Ana', service_name: 'Corte', starts_at: '2026-10-10T13:00:00Z', previous_starts_at: null, seen_at: null, created_at: '2026-10-09T12:00:00Z' }

  it('cada novedad de turno es una notificación de la categoría Turnos', () => {
    const [item] = appointmentEventsToNotifications([event], 'America/Asuncion', vi.fn())
    expect(item).toMatchObject({ id: 'agenda:e1', category: 'agenda', title: 'Nueva reserva', type: 'success', read: false })
    expect(item.message).toContain('Ana')
    expect(isAppointmentNotification(item.id)).toBe(true)
    expect(appointmentEventsToNotifications([{ ...event, kind: 'cancelled', seen_at: 'x' }], 'America/Asuncion', vi.fn())[0]).toMatchObject({ title: 'Turno cancelado', type: 'warning', read: true })
  })

  it('el encabezado del panel las suma solo con el módulo de servicios', () => {
    const header = readFileSync(resolve(process.cwd(), 'src/components/dashboard/header.tsx'), 'utf8')
    expect(header).toContain("useAppointmentNotifications(Boolean(user) && effectiveModules.includes('services'))")
  })

  it('se puede marcar una sola como vista', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/agenda/events/route.ts'), 'utf8')
    expect(route).toContain("if (id?.success) query = query.eq('id', id.data)")
  })
})
