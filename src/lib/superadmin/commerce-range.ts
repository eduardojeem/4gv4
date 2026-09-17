/**
 * El período de las métricas comerciales.
 *
 * Solo había 7, 30 y 90 días: no se podía ver un año, comparar 2025 con 2024
 * ni mirar un rango puntual como una temporada. Acá se resuelve cualquier
 * período a fechas de Paraguay, con el período anterior para comparar y la
 * forma de agruparlo en el gráfico.
 *
 * Las fechas son `AAAA-MM-DD` y la cuenta se hace en UTC sobre esas cadenas,
 * así un cambio de horario no corre un día.
 */

const DAY = 86_400_000
const TIME_ZONE = 'America/Asuncion'

/** Tope de un rango a elección: más que eso es mucho para leer de una vez. */
export const MAX_RANGE_DAYS = 3 * 366

export type CommerceGranularity = 'day' | 'week' | 'month'

export type CommerceRange = {
  /** Lo que va en la dirección: `30`, `anio`, `2025` o `personalizado`. */
  key: string
  from: string
  to: string
  days: number
  /** Con preposición, para usar en una frase: «en los últimos 30 días». */
  label: string
  /** Corto, para botones y encabezados: «30 días», «2025». */
  short: string
  /** El período anterior con el que se compara. */
  previous: { from: string; to: string }
  granularity: CommerceGranularity
}

export const RANGE_PRESETS = [
  { key: '7', days: 7, short: '7 días', label: 'en los últimos 7 días' },
  { key: '30', days: 30, short: '30 días', label: 'en los últimos 30 días' },
  { key: '90', days: 90, short: '90 días', label: 'en los últimos 90 días' },
  { key: '180', days: 180, short: '6 meses', label: 'en los últimos 6 meses' },
  { key: '365', days: 365, short: '12 meses', label: 'en los últimos 12 meses' },
] as const

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** El día de Paraguay de un instante, como `2026-09-16`. */
export function localDay(value: string | number | Date): string {
  return dayFormatter.format(new Date(value))
}

const toUtc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
const fromUtc = (time: number) => new Date(time).toISOString().slice(0, 10)

export function addDays(day: string, amount: number): string {
  return fromUtc(toUtc(day) + amount * DAY)
}

/** Días entre dos fechas, contando las dos. */
export function daysInRange(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY) + 1
}

/** Una fecha `AAAA-MM-DD` que existe en el calendario. */
export function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return fromUtc(toUtc(value)) === value
}

export function granularityFor(days: number): CommerceGranularity {
  if (days <= 62) return 'day'
  if (days <= 190) return 'week'
  return 'month'
}

/** A qué barra del gráfico va un día: el día, el lunes de su semana o su mes. */
export function bucketOf(day: string, granularity: CommerceGranularity): string {
  if (granularity === 'day') return day
  if (granularity === 'month') return `${day.slice(0, 7)}-01`
  const weekday = (new Date(toUtc(day)).getUTCDay() + 6) % 7 // lunes = 0
  return addDays(day, -weekday)
}

/** Las barras del período, en orden, aunque alguna quede vacía. */
export function bucketsInRange(from: string, to: string, granularity: CommerceGranularity): string[] {
  const buckets: string[] = []
  let current = bucketOf(from, granularity)
  while (current <= to) {
    buckets.push(current)
    current = granularity === 'day'
      ? addDays(current, 1)
      : granularity === 'week'
        ? addDays(current, 7)
        : `${Number(current.slice(5, 7)) === 12 ? Number(current.slice(0, 4)) + 1 : current.slice(0, 4)}-${String((Number(current.slice(5, 7)) % 12) + 1).padStart(2, '0')}-01`
  }
  return buckets
}

const shortDate = new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** «16 sep» o, si no es de este año, «16 sep 2025». */
export function formatRangeDay(day: string, withYear = false): string {
  return (withYear ? longDate : shortDate).format(new Date(toUtc(day)))
}

function build(key: string, from: string, to: string, label: string, short: string, previous?: { from: string; to: string }): CommerceRange {
  const days = daysInRange(from, to)
  return {
    key,
    from,
    to,
    days,
    label,
    short,
    previous: previous ?? { from: addDays(from, -days), to: addDays(from, -1) },
    granularity: granularityFor(days),
  }
}

/**
 * Lee el período de la dirección: `periodo=30`, `periodo=anio` (lo que va del
 * año), `periodo=2025` o `desde=…&hasta=…`. Lo inválido vuelve a 30 días.
 */
export function resolveCommerceRange(
  params: { periodo?: string; desde?: string; hasta?: string },
  now: number,
  firstYear = 2020,
): CommerceRange {
  const today = localDay(now)
  const year = Number(today.slice(0, 4))

  // Rango a elección.
  if (isValidDay(params.desde) && isValidDay(params.hasta)) {
    const from = params.desde
    const to = params.hasta > today ? today : params.hasta
    if (from <= to && daysInRange(from, to) <= MAX_RANGE_DAYS) {
      const sameYear = from.slice(0, 4) === to.slice(0, 4)
      const label = from === to
        ? `el ${formatRangeDay(from, true)}`
        : `del ${formatRangeDay(from, !sameYear)} al ${formatRangeDay(to, true)}`
      const short = from === to ? formatRangeDay(from, true) : `${formatRangeDay(from, !sameYear)} – ${formatRangeDay(to, true)}`
      return build('personalizado', from, to, label, short)
    }
  }

  const preset = RANGE_PRESETS.find((option) => option.key === params.periodo)
  if (preset) return build(preset.key, addDays(today, -(preset.days - 1)), today, preset.label, preset.short)

  // Lo que va del año, contra el mismo tramo del año anterior.
  if (params.periodo === 'anio') {
    const from = `${year}-01-01`
    const previousTo = `${year - 1}${today.slice(4)}`
    return build('anio', from, today, `en lo que va de ${year}`, 'Este año', {
      from: `${year - 1}-01-01`,
      to: isValidDay(previousTo) ? previousTo : `${year - 1}-02-28`,
    })
  }

  // Un año completo, contra el año anterior completo.
  if (/^\d{4}$/.test(params.periodo ?? '')) {
    const chosen = Number(params.periodo)
    if (chosen >= firstYear && chosen <= year) {
      const to = chosen === year ? today : `${chosen}-12-31`
      return build(String(chosen), `${chosen}-01-01`, to, `en ${chosen}`, String(chosen), {
        from: `${chosen - 1}-01-01`,
        to: chosen === year ? `${chosen - 1}${today.slice(4)}` : `${chosen - 1}-12-31`,
      })
    }
  }

  const fallback = RANGE_PRESETS[1]
  return build(fallback.key, addDays(today, -(fallback.days - 1)), today, fallback.label, fallback.short)
}

/** Los parámetros de la dirección para un período. */
export function rangeQuery(range: Pick<CommerceRange, 'key' | 'from' | 'to'>): Record<string, string> {
  return range.key === 'personalizado' ? { desde: range.from, hasta: range.to } : { periodo: range.key }
}

/** Los años que se pueden elegir, del más reciente al más viejo. */
export function selectableYears(now: number, firstYear: number): number[] {
  const year = Number(localDay(now).slice(0, 4))
  const years: number[] = []
  for (let current = year; current >= Math.min(firstYear, year); current -= 1) years.push(current)
  return years
}
