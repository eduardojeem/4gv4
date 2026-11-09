/**
 * Analytics de la agenda: lo que mira una barbería, un salón o un centro de
 * estética, que vende turnos más que productos. Funciones puras: el servidor
 * trae los turnos y acá se calcula todo, en la zona horaria del negocio.
 */
import { utcToZoned } from '@/lib/agenda/time'

export type AgendaAppointmentRow = {
  id: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | string
  source: 'dashboard' | 'online' | string | null
  price: number | string | null
  sale_id: string | null
  starts_at: string
  ends_at: string | null
  professional_id: string | null
  service_product_id: string | null
  service_name: string | null
  customer_id: string | null
  customer_phone: string | null
  customer_name: string | null
}

export type AgendaRankingRow = {
  key: string
  name: string
  booked: number
  completed: number
  noShow: number
  revenue: number
}

export type AgendaAnalytics = {
  /** Turnos del período sin contar los cancelados. */
  booked: number
  completed: number
  noShow: number
  cancelled: number
  /** Todavía por venir dentro del período (pendientes o confirmados). */
  upcoming: number
  /** Ya pasaron y nadie marcó si vino: quedan fuera de asistencia y facturación. */
  unclosed: number
  /** Completados / (completados + no vino). Null sin turnos cerrados. */
  attendanceRate: number | null
  /** Cancelados / todos los turnos del período. */
  cancellationRate: number | null
  /** Lo que valen los turnos completados. */
  revenue: number
  /** De eso, lo que ya se cobró en caja (turno con venta). */
  chargedRevenue: number
  averageTicket: number | null
  /** Reservados por el cliente desde la página pública. */
  online: number
  onlineShare: number | null
  /** Horas de agenda ocupadas (sin cancelados). */
  bookedHours: number
  /** Valor de lo que se perdió por inasistencias. */
  noShowValue: number
  customers: { unique: number; new: number; returning: number }
  /** Pendientes o confirmados en los próximos 7 días desde ahora. */
  nextSevenDays: number
  services: AgendaRankingRow[]
  professionals: AgendaRankingRow[]
  /** Lunes a domingo. */
  byWeekday: Array<{ label: string; count: number }>
  byHour: Array<{ label: string; count: number }>
  daily: Array<{ date: string; completed: number; noShow: number; cancelled: number; open: number }>
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const OPEN_STATUSES = new Set(['pending', 'confirmed'])

const money = (value: number | string | null) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

/** Un mismo cliente aunque se haya cargado sin ficha: por id, teléfono o nombre. */
export function appointmentCustomerKey(row: Pick<AgendaAppointmentRow, 'customer_id' | 'customer_phone' | 'customer_name'>): string | null {
  if (row.customer_id) return `id:${row.customer_id}`
  const phone = (row.customer_phone ?? '').replace(/\D/g, '')
  if (phone.length >= 6) return `tel:${phone.slice(-9)}`
  const name = (row.customer_name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return name ? `nombre:${name}` : null
}

const ratio = (part: number, total: number) => (total > 0 ? (part / total) * 100 : null)

/**
 * @param rows   Turnos de la empresa hasta el fin del período (o hasta dentro de
 *               7 días, si es más tarde): la historia sirve para saber quién es
 *               cliente nuevo y los próximos turnos para «Próximos 7 días».
 * @param range  Instantes de inicio y fin del período (ms).
 */
export function buildAgendaAnalytics(
  rows: AgendaAppointmentRow[],
  options: {
    from: number
    to: number
    now: number
    timeZone: string
    professionalNames?: Record<string, string>
  },
): AgendaAnalytics {
  const { from, to, now, timeZone, professionalNames = {} } = options
  const inRange = rows.filter((row) => {
    const at = Date.parse(row.starts_at)
    return at >= from && at <= to
  })

  // Primer turno (no cancelado) de cada cliente en toda la historia.
  const firstVisit = new Map<string, number>()
  for (const row of rows) {
    if (row.status === 'cancelled') continue
    const key = appointmentCustomerKey(row)
    if (!key) continue
    const at = Date.parse(row.starts_at)
    const current = firstVisit.get(key)
    if (current === undefined || at < current) firstVisit.set(key, at)
  }

  let completed = 0
  let noShow = 0
  let cancelled = 0
  let upcoming = 0
  let unclosed = 0
  let revenue = 0
  let chargedRevenue = 0
  let online = 0
  let bookedMinutes = 0
  let noShowValue = 0
  const customerKeys = new Set<string>()
  const services = new Map<string, AgendaRankingRow>()
  const professionals = new Map<string, AgendaRankingRow>()
  const weekdayCounts = new Array(7).fill(0)
  const hourCounts = new Map<number, number>()
  const daily = new Map<string, { completed: number; noShow: number; cancelled: number; open: number }>()

  const rank = (map: Map<string, AgendaRankingRow>, key: string, name: string) => {
    let entry = map.get(key)
    if (!entry) {
      entry = { key, name, booked: 0, completed: 0, noShow: 0, revenue: 0 }
      map.set(key, entry)
    }
    return entry
  }

  for (const row of inRange) {
    const start = Date.parse(row.starts_at)
    const local = utcToZoned(start, timeZone)
    const day = daily.get(local.date) ?? { completed: 0, noShow: 0, cancelled: 0, open: 0 }
    daily.set(local.date, day)

    if (row.status === 'cancelled') {
      cancelled += 1
      day.cancelled += 1
      continue
    }

    const price = money(row.price)
    const serviceKey = row.service_product_id ?? `nombre:${(row.service_name ?? 'Servicio').trim().toLowerCase()}`
    const service = rank(services, serviceKey, row.service_name?.trim() || 'Servicio sin nombre')
    const professional = rank(
      professionals,
      row.professional_id ?? 'sin-asignar',
      row.professional_id ? professionalNames[row.professional_id] ?? 'Profesional' : 'Sin profesional asignado',
    )
    service.booked += 1
    professional.booked += 1

    if (row.source === 'online') online += 1
    const end = row.ends_at ? Date.parse(row.ends_at) : start
    if (end > start) bookedMinutes += (end - start) / 60_000
    weekdayCounts[local.weekday] += 1
    const hour = Math.floor(local.minutes / 60)
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    const customerKey = appointmentCustomerKey(row)
    if (customerKey) customerKeys.add(customerKey)

    if (row.status === 'completed') {
      completed += 1
      day.completed += 1
      revenue += price
      if (row.sale_id) chargedRevenue += price
      service.completed += 1
      service.revenue += price
      professional.completed += 1
      professional.revenue += price
    } else if (row.status === 'no_show') {
      noShow += 1
      day.noShow += 1
      noShowValue += price
      service.noShow += 1
      professional.noShow += 1
    } else if (OPEN_STATUSES.has(row.status)) {
      day.open += 1
      if (start >= now) upcoming += 1
      else unclosed += 1
    }
  }

  let newCustomers = 0
  for (const key of customerKeys) {
    const first = firstVisit.get(key)
    if (first !== undefined && first >= from && first <= to) newCustomers += 1
  }

  const weekAhead = now + 7 * 24 * 60 * 60 * 1000
  const nextSevenDays = rows.filter((row) => {
    const at = Date.parse(row.starts_at)
    return OPEN_STATUSES.has(row.status) && at >= now && at < weekAhead
  }).length

  const booked = inRange.length - cancelled
  const byRanking = (a: AgendaRankingRow, b: AgendaRankingRow) => b.booked - a.booked || b.revenue - a.revenue || a.name.localeCompare(b.name)
  const hours = [...hourCounts.keys()]
  const firstHour = hours.length ? Math.min(...hours) : 0
  const lastHour = hours.length ? Math.max(...hours) : -1

  return {
    booked,
    completed,
    noShow,
    cancelled,
    upcoming,
    unclosed,
    attendanceRate: ratio(completed, completed + noShow),
    cancellationRate: ratio(cancelled, inRange.length),
    revenue,
    chargedRevenue,
    averageTicket: completed > 0 ? revenue / completed : null,
    online,
    onlineShare: ratio(online, booked),
    bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
    noShowValue,
    customers: { unique: customerKeys.size, new: newCustomers, returning: customerKeys.size - newCustomers },
    nextSevenDays,
    services: [...services.values()].sort(byRanking),
    professionals: [...professionals.values()].sort(byRanking),
    // La semana del negocio arranca el lunes.
    byWeekday: [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({ label: WEEKDAY_SHORT[weekday], count: weekdayCounts[weekday] })),
    byHour: Array.from({ length: Math.max(0, lastHour - firstHour + 1) }, (_, index) => {
      const hour = firstHour + index
      return { label: `${String(hour).padStart(2, '0')}h`, count: hourCounts.get(hour) ?? 0 }
    }),
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({ date, ...counts })),
  }
}

export type AgendaInsight = { id: string; tone: 'success' | 'warning' | 'danger' | 'info'; title: string; description: string }

/** Lo que conviene mirar, en palabras del negocio. */
export function buildAgendaInsights(data: AgendaAnalytics): AgendaInsight[] {
  const insights: AgendaInsight[] = []
  if (data.unclosed > 0) {
    insights.push({
      id: 'agenda-unclosed',
      tone: 'warning',
      title: `${data.unclosed} ${data.unclosed === 1 ? 'turno pasado sin cerrar' : 'turnos pasados sin cerrar'}`,
      description: 'Ya pasaron y siguen pendientes o confirmados. Marcalos como atendidos o «no vino» en la agenda: si no, no cuentan en asistencia ni en lo facturado.',
    })
  }
  if (data.attendanceRate !== null && data.completed + data.noShow >= 5 && data.attendanceRate < 85) {
    insights.push({
      id: 'agenda-no-shows',
      tone: data.attendanceRate < 70 ? 'danger' : 'warning',
      title: `${(100 - data.attendanceRate).toFixed(0)}% de los clientes no vinieron`,
      description: `Se perdieron ${data.noShow} ${data.noShow === 1 ? 'turno' : 'turnos'}. Pedir confirmación y mandar recordatorio por WhatsApp el día anterior suele bajar las inasistencias.`,
    })
  }
  if (data.cancellationRate !== null && data.booked + data.cancelled >= 5 && data.cancellationRate >= 20) {
    insights.push({
      id: 'agenda-cancellations',
      tone: 'warning',
      title: `${data.cancellationRate.toFixed(0)}% de los turnos se cancelaron`,
      description: 'Si se cancelan con poca anticipación, conviene ofrecer el horario libre a otros clientes o pedir una seña al reservar.',
    })
  }
  const busiest = [...data.byWeekday].sort((a, b) => b.count - a.count)[0]
  const quietest = [...data.byWeekday].filter((day) => day.count > 0).sort((a, b) => a.count - b.count)[0]
  if (busiest && quietest && busiest.count >= 3 && busiest.count >= quietest.count * 2) {
    insights.push({
      id: 'agenda-busy-days',
      tone: 'info',
      title: `${busiest.label} es el día con más turnos`,
      description: `${busiest.count} turnos contra ${quietest.count} el ${quietest.label}. Una promoción para el día más tranquilo puede llenar huecos.`,
    })
  }
  if (data.onlineShare !== null && data.booked >= 5 && data.onlineShare < 15) {
    insights.push({
      id: 'agenda-online',
      tone: 'info',
      title: 'Casi todos los turnos se cargan a mano',
      description: 'Compartí el link de reservas en Instagram y WhatsApp: los clientes reservan solos, a cualquier hora.',
    })
  }
  if (data.customers.unique >= 5 && data.customers.returning / data.customers.unique >= 0.5) {
    insights.push({
      id: 'agenda-loyal',
      tone: 'success',
      title: 'La mayoría de tus clientes vuelve',
      description: `${data.customers.returning} de ${data.customers.unique} clientes ya habían venido antes.`,
    })
  }
  return insights
}
