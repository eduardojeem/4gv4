export type MonitorPeriodValue = 'today' | 'week' | 'month' | 'year' | 'all'

export interface SessionPeriodInput {
  period?: MonitorPeriodValue
  dateFrom?: string
  dateTo?: string
  status?: string
}

export interface SessionPeriodFilter {
  /** Limite inferior sobre `created_at`, o `null` si no hay. */
  from: string | null
  /** Limite superior sobre `created_at`, o `null` si no hay. */
  to: string | null
  /**
   * Las cajas abiertas entran aunque queden fuera del rango. Falso solo cuando
   * se pidieron explicitamente las cerradas.
   */
  keepOpen: boolean
  /**
   * Expresion para `.or(...)` de PostgREST, o `null` cuando alcanza con los
   * `.gte`/`.lte` de siempre.
   */
  orExpression: string | null
}

/**
 * Que rango de fechas se le pide a `cash_closures`, y por que las cajas abiertas
 * se saltean ese rango.
 *
 * `created_at` de un turno es CUANDO SE ABRIO. Con el filtro por defecto —los
 * ultimos 7 dias— una caja abierta hace diez dias quedaba fuera de la consulta:
 * «Cajas Abiertas en Vivo» mostraba 0 teniendo una abierta en ese momento, y la
 * pestaña En Vivo salia vacia. Justo la caja que mas hay que mirar, que es la
 * que lleva mas tiempo abierta, era la que desaparecia.
 *
 * «En vivo» es ahora: el periodo acota el historial, no el presente.
 */
export function buildSessionPeriodFilter(
  filter: SessionPeriodInput,
  now: Date = new Date()
): SessionPeriodFilter {
  let cutoff: Date | null = null

  if (filter.period === 'today') {
    cutoff = new Date(now)
    cutoff.setHours(0, 0, 0, 0)
  } else if (filter.period === 'week' || !filter.period) {
    cutoff = new Date(now)
    cutoff.setDate(now.getDate() - 7)
  } else if (filter.period === 'month') {
    cutoff = new Date(now)
    cutoff.setMonth(now.getMonth() - 1)
  } else if (filter.period === 'year') {
    cutoff = new Date(now)
    cutoff.setFullYear(now.getFullYear() - 1)
  }

  const from = filter.dateFrom || (cutoff && filter.period !== 'all' ? cutoff.toISOString() : null)
  const to = filter.dateTo || null
  const keepOpen = filter.status !== 'closed'

  let orExpression: string | null = null
  if (keepOpen) {
    if (from && to) orExpression = `date.is.null,and(created_at.gte.${from},created_at.lte.${to})`
    else if (from) orExpression = `date.is.null,created_at.gte.${from}`
    else if (to) orExpression = `date.is.null,created_at.lte.${to}`
  }

  return { from, to, keepOpen, orExpression }
}
