/**
 * Mecánica del sorteo: asignación de números y elección de ganadores.
 *
 * Todo lo aleatorio pasa por un generador con semilla. Sirve para dos cosas
 * distintas y las dos importan:
 *
 *  - se puede testear (con `Math.random` no habría forma de afirmar nada);
 *  - la jugada queda **reproducible**: guardando la semilla, cualquiera puede
 *    volver a correr el sorteo y verificar que salió lo que se publicó. Sin
 *    eso, "fue al azar" es una afirmación que nadie puede comprobar.
 *
 * La ejecución real la hace la base (`public.draw_raffle_winners`), que además
 * impide repetir el sorteo. Este módulo es el mismo algoritmo, testeable, y el
 * que usa la vista previa del panel.
 */

export interface RaffleTicket {
  id: string
  customerId: string
  ticketNumber: number
}

export interface RafflePrize {
  position: number
  title: string
  details?: string
}

export interface RaffleWinner {
  prizePosition: number
  prizeTitle: string
  ticketId: string
  ticketNumber: number
  customerId: string
}

/** Generador reproducible: la misma semilla da siempre la misma secuencia. */
export type Rng = () => number

/**
 * mulberry32 sobre un hash de la semilla.
 *
 * No es criptográfico y no hace falta que lo sea: la semilla se genera del lado
 * del servidor y se publica recién después del sorteo, así que nadie puede
 * anticiparla para elegir un número conveniente.
 */
export function createSeededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length

  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }

  let state = h >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Asigna `quantity` números libres, tomados al azar del pool.
 *
 * Se sortean en vez de darlos en orden para que nadie pueda deducir cuántos
 * participantes hay ni comprar "el próximo número". Devuelve menos de los
 * pedidos solo si el pool se queda sin lugar.
 */
export function allocateTicketNumbers(
  poolSize: number,
  taken: Iterable<number>,
  quantity: number,
  rng: Rng,
): number[] {
  const size = Math.floor(poolSize)
  const wanted = Math.floor(quantity)

  if (!Number.isFinite(size) || size <= 0) return []
  if (!Number.isFinite(wanted) || wanted <= 0) return []

  const used = new Set<number>()
  for (const n of taken) {
    if (Number.isFinite(n)) used.add(Math.floor(n))
  }

  const free = size - used.size
  if (free <= 0) return []

  const toIssue = Math.min(wanted, free)
  const issued: number[] = []

  // Muestreo por rechazo mientras el pool esté holgado: no hace falta
  // materializar un millon de numeros para entregar tres.
  if (free > size / 4) {
    let guard = 0
    while (issued.length < toIssue && guard < toIssue * 200) {
      guard += 1
      const candidate = Math.floor(rng() * size) + 1
      if (used.has(candidate)) continue
      used.add(candidate)
      issued.push(candidate)
    }
    if (issued.length === toIssue) return issued.sort((a, b) => a - b)
  }

  // Pool casi lleno: se arma la lista de lo que queda y se elige de ahí.
  const available: number[] = []
  for (let n = 1; n <= size; n += 1) {
    if (!used.has(n)) available.push(n)
  }

  while (issued.length < toIssue && available.length > 0) {
    const index = Math.floor(rng() * available.length)
    const [picked] = available.splice(index, 1)
    issued.push(picked)
  }

  return issued.sort((a, b) => a - b)
}

/**
 * Elige un ganador por premio.
 *
 * Dos garantías: un mismo número no gana dos veces, y una misma persona no se
 * lleva dos premios del mismo sorteo. La segunda es una decisión de producto —
 * quien compró 50 números tiene 50 veces más chances de ganar *algo*, pero no
 * puede quedarse con toda la mesa.
 */
export function drawWinners(
  tickets: RaffleTicket[],
  prizes: RafflePrize[],
  rng: Rng,
): RaffleWinner[] {
  const pool = (tickets ?? []).filter((t) => t && t.id && t.customerId)
  const orderedPrizes = [...(prizes ?? [])].sort((a, b) => a.position - b.position)

  if (pool.length === 0 || orderedPrizes.length === 0) return []

  const winners: RaffleWinner[] = []
  const alreadyWon = new Set<string>()
  let remaining = [...pool]

  for (const prize of orderedPrizes) {
    const eligible = remaining.filter((t) => !alreadyWon.has(t.customerId))
    if (eligible.length === 0) break

    const index = Math.floor(rng() * eligible.length)
    const ticket = eligible[Math.min(index, eligible.length - 1)]

    winners.push({
      prizePosition: prize.position,
      prizeTitle: prize.title,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      customerId: ticket.customerId,
    })

    alreadyWon.add(ticket.customerId)
    remaining = remaining.filter((t) => t.customerId !== ticket.customerId)
  }

  return winners
}

/** Chance de ganar algo, para mostrarla honestamente antes de canjear. */
export function winningOdds(ticketsOwned: number, totalTickets: number): number {
  const owned = Math.max(0, Math.floor(ticketsOwned))
  const total = Math.max(0, Math.floor(totalTickets))

  if (total === 0 || owned === 0) return 0
  return Math.min(1, owned / total)
}
