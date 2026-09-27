/**
 * Juego responsable.
 *
 * El canje de puntos por números es una mecánica de azar, y conviene tratarla
 * como tal aunque no se cobre dinero: hay un incentivo directo a gastar más
 * para participar más. Las reglas de acá se evalúan **antes** de tocar el
 * saldo, y la base las vuelve a evaluar en `redeem_points_for_raffle_tickets`
 * — el navegador no decide nada.
 */

export interface RaffleForParticipation {
  id: string
  name: string
  status: 'draft' | 'published' | 'closed' | 'completed' | 'cancelled'
  startsAt: string | Date
  endsAt: string | Date
  pointsPerTicket: number
  maxTicketsPerCustomer?: number | null
  maxTicketsTotal: number
  minAge: number
}

export interface ParticipantAccount {
  balance: number
  /** Fecha hasta la que el cliente pidió no participar. */
  selfExcludedUntil?: string | Date | null
  /** Edad declarada. undefined = no se cargó. */
  age?: number | null
}

export interface ParticipationRequest {
  raffle: RaffleForParticipation
  account: ParticipantAccount
  quantity: number
  ticketsAlreadyOwned: number
  ticketsIssuedTotal: number
  now?: Date
}

export type BlockReason =
  | 'raffle_not_published'
  | 'raffle_not_started'
  | 'raffle_ended'
  | 'self_excluded'
  | 'under_age'
  | 'invalid_quantity'
  | 'insufficient_points'
  | 'per_customer_limit'
  | 'pool_exhausted'

export interface ParticipationCheck {
  allowed: boolean
  reason: BlockReason | null
  message: string
  pointsCost: number
  /** Cuántos números más podría llevar ahora mismo. */
  maxAllowedNow: number
}

/** Tope duro: nadie canjea más de esto de una sola vez. */
export const MAX_TICKETS_PER_OPERATION = 100

function toTime(value: string | Date | null | undefined): number {
  if (value == null) return NaN
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value))
  return Number.isFinite(t) ? t : NaN
}

function toInt(value: unknown): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? n : 0
}

/**
 * Cuántos números puede llevarse el cliente ahora, según saldo, tope personal
 * y lo que queda del pool. Es el número que la UI usa para limitar el input,
 * en vez de dejar pedir 500 y fallar recién al confirmar.
 */
export function maxTicketsAllowed(request: Omit<ParticipationRequest, 'quantity'>): number {
  const { raffle, account } = request
  const cost = Math.max(1, toInt(raffle.pointsPerTicket))

  const byBalance = Math.floor(Math.max(0, toInt(account.balance)) / cost)

  const byCustomerCap = raffle.maxTicketsPerCustomer == null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, toInt(raffle.maxTicketsPerCustomer) - toInt(request.ticketsAlreadyOwned))

  const byPool = Math.max(0, toInt(raffle.maxTicketsTotal) - toInt(request.ticketsIssuedTotal))

  return Math.max(0, Math.min(byBalance, byCustomerCap, byPool, MAX_TICKETS_PER_OPERATION))
}

/** Evalúa si este canje puede seguir adelante, y por qué no si no puede. */
export function checkParticipation(request: ParticipationRequest): ParticipationCheck {
  const { raffle, account, now = new Date() } = request
  const quantity = toInt(request.quantity)
  const cost = Math.max(1, toInt(raffle.pointsPerTicket)) * Math.max(0, quantity)
  const maxAllowedNow = maxTicketsAllowed(request)

  const deny = (reason: BlockReason, message: string): ParticipationCheck => ({
    allowed: false,
    reason,
    message,
    pointsCost: cost,
    maxAllowedNow,
  })

  // La autoexclusión se evalúa primero, a propósito: es la única razón que no
  // debe poder sortearse cambiando otra condición.
  const excludedUntil = toTime(account.selfExcludedUntil)
  if (Number.isFinite(excludedUntil) && excludedUntil > now.getTime()) {
    const date = new Date(excludedUntil).toLocaleDateString('es-PY')
    return deny('self_excluded', `Este cliente pidió no participar en sorteos hasta el ${date}.`)
  }

  if (raffle.minAge > 0 && account.age != null && toInt(account.age) < raffle.minAge) {
    return deny('under_age', `Hay que tener ${raffle.minAge} años o más para participar.`)
  }

  if (raffle.status !== 'published') {
    return deny('raffle_not_published', 'El sorteo no está abierto a participación.')
  }

  const startsAt = toTime(raffle.startsAt)
  const endsAt = toTime(raffle.endsAt)

  if (Number.isFinite(startsAt) && now.getTime() < startsAt) {
    return deny('raffle_not_started', 'El sorteo todavía no comenzó.')
  }

  if (Number.isFinite(endsAt) && now.getTime() >= endsAt) {
    return deny('raffle_ended', 'El sorteo ya cerró.')
  }

  if (quantity <= 0 || quantity > MAX_TICKETS_PER_OPERATION) {
    return deny('invalid_quantity', `Elegí entre 1 y ${MAX_TICKETS_PER_OPERATION} números.`)
  }

  const poolLeft = Math.max(0, toInt(raffle.maxTicketsTotal) - toInt(request.ticketsIssuedTotal))
  if (poolLeft < quantity) {
    return deny('pool_exhausted', `Quedan ${poolLeft} número(s) disponibles en este sorteo.`)
  }

  if (raffle.maxTicketsPerCustomer != null) {
    const owned = toInt(request.ticketsAlreadyOwned)
    if (owned + quantity > toInt(raffle.maxTicketsPerCustomer)) {
      return deny(
        'per_customer_limit',
        `Máximo ${raffle.maxTicketsPerCustomer} números por persona en este sorteo. Ya tiene ${owned}.`,
      )
    }
  }

  if (toInt(account.balance) < cost) {
    return deny(
      'insufficient_points',
      `Le faltan ${cost - toInt(account.balance)} puntos: cuesta ${cost} y tiene ${toInt(account.balance)}.`,
    )
  }

  return {
    allowed: true,
    reason: null,
    message: `Canjea ${cost} puntos por ${quantity} número(s).`,
    pointsCost: cost,
    maxAllowedNow,
  }
}

/** Leyenda obligatoria en la ficha pública del sorteo. */
export function responsiblePlayNotice(raffle: Pick<RaffleForParticipation, 'minAge'>): string {
  return [
    `Participación exclusiva para mayores de ${raffle.minAge} años.`,
    'Los puntos canjeados no se devuelven ni se cambian por dinero.',
    'Participar no garantiza obtener un premio.',
    'Si sentís que estás gastando de más para participar, pedí la autoexclusión en el local.',
  ].join(' ')
}
