import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { TimeOffEditor, timeOffInterval } from '@/components/dashboard/agenda/TimeOffEditor'
import { closuresToAnnounce, closureWhen, describeClosure, publicMessageProblem } from '@/lib/agenda/closures'

afterEach(() => vi.unstubAllGlobals())
const TZ = 'America/Asuncion'

describe('cierres avisados en la web', () => {
  it('un cierre de días se lee en días y dice cuándo vuelve', () => {
    // 24/12 00:00 a 27/12 00:00 en Asunción (UTC-3).
    const closure = { startsAt: '2026-12-24T03:00:00.000Z', endsAt: '2026-12-27T03:00:00.000Z', message: 'Vacaciones de fin de año' }
    expect(closureWhen(closure, TZ)).toBe('del jue 24/12 al sáb 26/12')
    const before = describeClosure(closure, TZ, new Date('2026-12-20T12:00:00Z'))
    expect(before).toMatchObject({ active: false, title: 'Cerrado del jue 24/12 al sáb 26/12', detail: 'Vacaciones de fin de año', reopens: null })
    const during = describeClosure(closure, TZ, new Date('2026-12-25T15:00:00Z'))
    expect(during).toMatchObject({ active: true, title: 'Hoy estamos cerrados', reopens: 'Volvemos el dom 27/12.' })
  })

  it('un cierre de horas muestra el horario', () => {
    expect(closureWhen({ startsAt: '2026-10-14T15:00:00.000Z', endsAt: '2026-10-14T17:00:00.000Z' }, TZ)).toBe('el mié 14/10 de 12:00 a 14:00')
  })

  it('se avisa el que está en curso y los de las próximas dos semanas', () => {
    const now = new Date('2026-10-10T12:00:00Z')
    const soon = { startsAt: '2026-10-15T03:00:00Z', endsAt: '2026-10-16T03:00:00Z', message: 'Feriado' }
    const far = { startsAt: '2026-11-20T03:00:00Z', endsAt: '2026-11-21T03:00:00Z', message: 'Capacitación' }
    const past = { startsAt: '2026-10-01T03:00:00Z', endsAt: '2026-10-02T03:00:00Z', message: 'Viejo' }
    expect(closuresToAnnounce([far, past, soon], now)).toEqual([soon])
  })

  it('solo los cierres de toda la tienda, con un texto de 3 a 160 letras', () => {
    expect(publicMessageProblem('Cerrado', 'prof-1')).toMatch(/toda la tienda/)
    expect(publicMessageProblem('ab', null)).toMatch(/3 letras/)
    expect(publicMessageProblem('Cerrado por vacaciones', null)).toBeNull()
    expect(publicMessageProblem('', 'prof-1')).toBeNull()
  })

  it('«todo el día» va de medianoche a medianoche y valida el período', () => {
    expect(timeOffInterval({ allDay: true, fromDate: '2026-12-24', toDate: '2026-12-26', fromTime: '', toTime: '' }, TZ))
      .toEqual({ startsAt: '2026-12-24T03:00:00.000Z', endsAt: '2026-12-27T03:00:00.000Z' })
    expect(timeOffInterval({ allDay: false, fromDate: '2026-10-14', toDate: '2026-10-14', fromTime: '14:00', toTime: '12:00' }, TZ)).toEqual({ error: 'El fin tiene que ser después del inicio.' })
  })
})

describe('editor de ausencias', () => {
  it('guarda un cierre de la tienda con su aviso para la web (sin publicar el motivo interno)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') return new Response(JSON.stringify({ block: { id: 'b1' }, publicMessageSaved: true }), { status: 201 })
      if (url.includes('?')) return new Response(JSON.stringify({ conflicts: [], total: 0 }))
      return new Response(JSON.stringify({ blocks: [], publicMessageAvailable: true }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<TimeOffEditor professionals={[]} timeZone={TZ} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vacaciones' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Avisar en la página web' }))
    expect(screen.getByLabelText('Qué leen tus clientes')).toHaveValue('Cerrado por vacaciones')
    expect(await screen.findByText('No hay turnos en ese período.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ausencia' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body))
    expect(body).toMatchObject({ professional_id: null, reason: 'Vacaciones', public_message: 'Cerrado por vacaciones' })
  })

  it('sin la migración no ofrece el aviso y lo explica', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes('?') ? { conflicts: [], total: 0 } : { blocks: [], publicMessageAvailable: false }))))
    render(<TimeOffEditor professionals={[]} timeZone={TZ} />)
    expect(await screen.findByText(/falta aplicar la migración/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Avisar en la página web' })).toBeDisabled()
  })
})

describe('la web muestra el cierre', () => {
  it('la agenda pública manda solo cierres de toda la tienda con aviso, y el encabezado los muestra', () => {
    const route = readFileSync('src/app/api/public/agenda/[slug]/route.ts', 'utf8')
    expect(route).toContain(".is('professional_id', null)")
    expect(route).toContain(".not('public_message', 'is', null)")
    expect(route).not.toMatch(/select\('[^']*reason/)
    const header = readFileSync('src/components/public/services/ServicesSiteHeader.tsx', 'utf8')
    expect(header).toContain('closuresToAnnounce(agendaExtras?.closures ?? [])[0]')
  })
})
