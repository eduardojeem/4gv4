/**
 * El programa de puntos dicho en una frase.
 *
 * Para usar la sección hay que tener en la cabeza tres monedas —guaraníes,
 * puntos y tickets— y cuatro conversiones entre ellas: cuánto gasto da un
 * punto, por cuánto lo multiplica una promoción, cuántos puntos cuesta un
 * ticket de sorteo y —si se habilita— a cuánto se venden los puntos en plata.
 * Ninguna pantalla decía las cuatro juntas, así que el dueño del negocio no
 * tenía forma de contarle el programa a un cliente.
 *
 * Esto arma esa frase: «Cada Gs. 10.000 de compra suma 1 punto. 50 puntos =
 * 1 ticket del sorteo.» Es la misma cuenta que hace la base al acreditar
 * (`award_loyalty_points_for_sale`), dicha en el idioma del mostrador.
 */

import { formatCurrency } from '@/lib/currency'

export type ExplainSettings = {
  enabled: boolean
  currency_per_point: number | string
  points_per_unit: number | string
}

export type ExplainRaffle = {
  name?: string | null
  points_per_ticket?: number | string | null
}

const puntos = (cantidad: number) => `${cantidad} ${cantidad === 1 ? 'punto' : 'puntos'}`

/** Cómo se ganan los puntos. Null si el programa está apagado o sin configurar. */
export function explainEarning(settings: ExplainSettings | null | undefined): string | null {
  if (!settings) return null

  const gasto = Number(settings.currency_per_point)
  const gana = Number(settings.points_per_unit)
  if (!Number.isFinite(gasto) || gasto <= 0 || !Number.isFinite(gana) || gana <= 0) return null

  return `Cada ${formatCurrency(gasto)} de compra suma ${puntos(gana)}`
}

/** Para qué sirven los puntos. Sin sorteo abierto, no sirven para nada todavía. */
export function explainSpending(raffle: ExplainRaffle | null | undefined): string | null {
  if (!raffle) return null

  const porTicket = Number(raffle.points_per_ticket)
  if (!Number.isFinite(porTicket) || porTicket <= 0) return null

  const nombre = raffle.name?.trim()
  return `${puntos(porTicket)} = 1 ticket${nombre ? ` de «${nombre}»` : ' de sorteo'}`
}

/**
 * Cuánto tiene que gastar un cliente para llegar a un ticket. Es la pregunta
 * que de verdad se hace en el mostrador, y no estaba en ninguna pantalla.
 */
export function explainTicketCost(
  settings: ExplainSettings | null | undefined,
  raffle: ExplainRaffle | null | undefined,
): string | null {
  if (!settings) return null
  const gasto = Number(settings.currency_per_point)
  const gana = Number(settings.points_per_unit)
  const porTicket = Number(raffle?.points_per_ticket)
  if (![gasto, gana, porTicket].every((n) => Number.isFinite(n) && n > 0)) return null

  const compraNecesaria = Math.ceil((porTicket / gana) * gasto)
  return `Un ticket sale ${formatCurrency(compraNecesaria)} de compra`
}

/**
 * Las tres frases juntas, en el orden en que se explican: qué suma, para qué
 * sirve y cuánto cuesta. Se saltean las que todavía no se pueden decir.
 */
export function explainProgram(
  settings: ExplainSettings | null | undefined,
  raffle?: ExplainRaffle | null,
): string[] {
  if (!settings?.enabled) return []
  return [explainEarning(settings), explainSpending(raffle), explainTicketCost(settings, raffle)]
    .filter((frase): frase is string => Boolean(frase))
}
