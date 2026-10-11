import { utcToZoned, WEEKDAY_LABELS } from '@/lib/agenda/time'

/** Un cierre de toda la tienda que el dueño decidió avisar en la página web. */
export type PublicClosure = { startsAt: string; endsAt: string; message: string }

/** Cuántos días antes se avisa un cierre que todavía no empezó. */
export const CLOSURE_NOTICE_DAYS = 14

const MIN_MESSAGE = 3
const MAX_MESSAGE = 160

/** Lo que se publica: con texto propio (3 a 160 letras) y solo de toda la tienda. */
export function publicMessageProblem(message: string | null | undefined, professionalId: string | null) {
  const text = message?.trim() ?? ''
  if (!text) return null
  if (professionalId) return 'Solo los cierres de toda la tienda se avisan en la página web.'
  if (text.length < MIN_MESSAGE) return 'Escribí al menos 3 letras.'
  if (text.length > MAX_MESSAGE) return `Hasta ${MAX_MESSAGE} letras.`
  return null
}

const day = (iso: string, timeZone: string) => {
  const local = utcToZoned(iso, timeZone)
  const [, month, dayOfMonth] = local.date.split('-')
  return { label: `${WEEKDAY_LABELS[local.weekday].slice(0, 3).toLowerCase()} ${dayOfMonth}/${month}`, date: local.date, time: local.time }
}

/**
 * Cómo se lee un cierre en la tienda: «Cerrado del sáb 24/12 al lun 26/12» o,
 * si es de horas, «Cerrado el mar 14/10 de 12:00 a 14:00». El fin se guarda
 * exclusivo (medianoche del día siguiente): para mostrarlo se resta un minuto.
 */
export function closureWhen(closure: Pick<PublicClosure, 'startsAt' | 'endsAt'>, timeZone: string) {
  const start = day(closure.startsAt, timeZone)
  const lastMinute = new Date(Date.parse(closure.endsAt) - 60_000).toISOString()
  const end = day(lastMinute, timeZone)
  const endTime = utcToZoned(closure.endsAt, timeZone).time
  const fullDays = start.time === '00:00' && endTime === '00:00'
  if (start.date === end.date) return fullDays ? `el ${start.label}` : `el ${start.label} de ${start.time} a ${endTime}`
  return fullDays ? `del ${start.label} al ${end.label}` : `del ${start.label} ${start.time} al ${end.label} ${endTime}`
}

export function describeClosure(closure: PublicClosure, timeZone: string, now: Date = new Date()) {
  const active = Date.parse(closure.startsAt) <= now.getTime() && now.getTime() < Date.parse(closure.endsAt)
  const start = day(closure.startsAt, timeZone)
  const fullDays = start.time === '00:00' && utcToZoned(closure.endsAt, timeZone).time === '00:00'
  const back = day(closure.endsAt, timeZone)
  const when = closureWhen(closure, timeZone)
  const reopens = fullDays ? `Volvemos el ${back.label}.` : `Volvemos a las ${utcToZoned(closure.endsAt, timeZone).time}${back.date !== day(now.toISOString(), timeZone).date ? ` del ${back.label}` : ''}.`

  return {
    active,
    title: active ? 'Hoy estamos cerrados' : `Cerrado ${when}`,
    detail: closure.message.trim(),
    reopens: active ? reopens : null,
  }
}

/** Los cierres que conviene avisar: el que está en curso y los de las próximas dos semanas. */
export function closuresToAnnounce(closures: PublicClosure[], now: Date = new Date()) {
  const horizon = now.getTime() + CLOSURE_NOTICE_DAYS * 86_400_000
  return closures
    .filter((closure) => Date.parse(closure.endsAt) > now.getTime() && Date.parse(closure.startsAt) <= horizon && closure.message.trim())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}
