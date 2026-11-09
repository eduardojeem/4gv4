import { describe, expect, it } from 'vitest'
import {
  appointmentCustomerKey,
  buildAgendaAnalytics,
  buildAgendaInsights,
  type AgendaAppointmentRow,
} from '@/lib/analytics/agenda-analytics'

const TZ = 'America/Asuncion'
// Asunción es UTC-3 todo el año.
const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString()
const plus = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()

let seq = 0
function turno(over: Partial<AgendaAppointmentRow> & { starts_at: string }): AgendaAppointmentRow {
  seq += 1
  return {
    id: `a${seq}`,
    status: 'completed',
    source: 'dashboard',
    price: 50000,
    sale_id: null,
    ends_at: plus(over.starts_at, 30),
    professional_id: 'p1',
    service_product_id: 's-corte',
    service_name: 'Corte',
    customer_id: null,
    customer_phone: null,
    customer_name: 'Cliente',
    ...over,
  }
}

const from = Date.parse(at('2026-10-05', '00:00')) // lunes
const to = Date.parse(at('2026-10-11', '23:59')) // domingo
const now = Date.parse(at('2026-10-09', '12:00')) // viernes al mediodía

describe('analytics de la agenda', () => {
  const rows = [
    // Antes del período: Ana ya era clienta.
    turno({ starts_at: at('2026-09-20', '10:00'), customer_phone: '0981 111 222', customer_name: 'Ana' }),
    // En el período.
    turno({ starts_at: at('2026-10-05', '09:00'), customer_phone: '+595981111222', customer_name: 'Ana', sale_id: 'v1' }),
    turno({ starts_at: at('2026-10-06', '09:30'), customer_name: 'Bruno', service_product_id: 's-barba', service_name: 'Barba', price: 30000, professional_id: 'p2', source: 'online' }),
    turno({ starts_at: at('2026-10-06', '15:00'), customer_name: 'Caro', status: 'no_show', price: 80000, service_product_id: 's-color', service_name: 'Color' }),
    turno({ starts_at: at('2026-10-07', '10:00'), customer_name: 'Dani', status: 'cancelled' }),
    turno({ starts_at: at('2026-10-08', '18:00'), customer_name: 'Eli', status: 'confirmed' }), // pasado sin cerrar
    turno({ starts_at: at('2026-10-10', '11:00'), customer_name: 'Fer', status: 'pending', source: 'online' }), // por venir
    // Después del período, dentro de 7 días desde hoy.
    turno({ starts_at: at('2026-10-13', '09:00'), customer_name: 'Gabi', status: 'confirmed' }),
  ]
  const data = buildAgendaAnalytics(rows, { from, to, now, timeZone: TZ, professionalNames: { p1: 'Lucas', p2: 'Sofi' } })

  it('cuenta los turnos por estado y separa lo que vino de lo que falta cerrar', () => {
    expect(data).toMatchObject({ booked: 5, completed: 2, noShow: 1, cancelled: 1, upcoming: 1, unclosed: 1, nextSevenDays: 2 })
  })

  it('asistencia, cancelaciones y reservas online', () => {
    expect(data.attendanceRate).toBeCloseTo((2 / 3) * 100)
    expect(data.cancellationRate).toBeCloseTo((1 / 6) * 100)
    expect(data.online).toBe(2)
    expect(data.onlineShare).toBeCloseTo((2 / 5) * 100)
  })

  it('factura solo lo atendido, y aparte lo ya cobrado en caja', () => {
    expect(data.revenue).toBe(80000)
    expect(data.chargedRevenue).toBe(50000)
    expect(data.averageTicket).toBe(40000)
    expect(data.noShowValue).toBe(80000)
  })

  it('reconoce al cliente que vuelve por su teléfono aunque esté escrito distinto', () => {
    expect(appointmentCustomerKey({ customer_id: null, customer_phone: '0981 111 222', customer_name: 'Ana' }))
      .toBe(appointmentCustomerKey({ customer_id: null, customer_phone: '+595981111222', customer_name: 'Ana P.' }))
    expect(data.customers).toEqual({ unique: 5, new: 4, returning: 1 })
  })

  it('rankea servicios y profesionales con sus nombres', () => {
    expect(data.services[0]).toMatchObject({ name: 'Corte', booked: 3, completed: 1 })
    expect(data.professionals.find((row) => row.key === 'p2')).toMatchObject({ name: 'Sofi', booked: 1, completed: 1, revenue: 30000 })
  })

  it('días y horas en la hora del negocio, con la semana desde el lunes', () => {
    expect(data.byWeekday.map((day) => day.label)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
    expect(data.byWeekday.find((day) => day.label === 'Mar')?.count).toBe(2)
    expect(data.byHour[0]).toEqual({ label: '09h', count: 2 })
    expect(data.bookedHours).toBe(2.5)
  })

  it('avisa de los turnos sin cerrar', () => {
    expect(buildAgendaInsights(data).map((insight) => insight.id)).toContain('agenda-unclosed')
  })

  it('con muchas inasistencias, lo marca como problema', () => {
    const muchas = Array.from({ length: 6 }, (_, index) =>
      turno({ starts_at: at('2026-10-06', `1${index}:00`), status: index < 3 ? 'no_show' : 'completed' }))
    const result = buildAgendaAnalytics(muchas, { from, to, now, timeZone: TZ })
    expect(buildAgendaInsights(result).find((insight) => insight.id === 'agenda-no-shows')).toMatchObject({ tone: 'danger' })
  })

  it('sin turnos no hay porcentajes inventados', () => {
    const empty = buildAgendaAnalytics([], { from, to, now, timeZone: TZ })
    expect(empty).toMatchObject({ booked: 0, attendanceRate: null, cancellationRate: null, onlineShare: null, averageTicket: null, byHour: [] })
    expect(buildAgendaInsights(empty)).toEqual([])
  })
})
