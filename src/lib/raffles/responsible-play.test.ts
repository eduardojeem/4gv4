import { describe, expect, it } from 'vitest'
import {
  MAX_TICKETS_PER_OPERATION,
  checkParticipation,
  maxTicketsAllowed,
  responsiblePlayNotice,
  type ParticipantAccount,
  type RaffleForParticipation,
} from './responsible-play'

const NOW = new Date('2026-08-27T12:00:00Z')

function raffle(overrides: Partial<RaffleForParticipation> = {}): RaffleForParticipation {
  return {
    id: 's-1',
    name: 'Sorteo de agosto',
    status: 'published',
    startsAt: '2026-08-01T00:00:00Z',
    endsAt: '2026-09-01T00:00:00Z',
    pointsPerTicket: 50,
    maxTicketsPerCustomer: 10,
    maxTicketsTotal: 1000,
    minAge: 18,
    ...overrides,
  }
}

function account(overrides: Partial<ParticipantAccount> = {}): ParticipantAccount {
  return { balance: 500, ...overrides }
}

function request(overrides: Partial<Parameters<typeof checkParticipation>[0]> = {}) {
  return {
    raffle: raffle(),
    account: account(),
    quantity: 2,
    ticketsAlreadyOwned: 0,
    ticketsIssuedTotal: 0,
    now: NOW,
    ...overrides,
  }
}

describe('checkParticipation — camino feliz', () => {
  it('deja participar y dice cuánto cuesta', () => {
    const result = checkParticipation(request())

    expect(result.allowed).toBe(true)
    expect(result.pointsCost).toBe(100)
    expect(result.message).toContain('100 puntos')
  })
})

describe('juego responsable', () => {
  it('la autoexclusión bloquea aunque tenga saldo y el sorteo esté abierto', () => {
    const result = checkParticipation(request({
      account: account({ balance: 999_999, selfExcludedUntil: '2026-12-01T00:00:00Z' }),
    }))

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('self_excluded')
  })

  it('la autoexclusión vencida deja de bloquear', () => {
    const result = checkParticipation(request({
      account: account({ selfExcludedUntil: '2026-08-01T00:00:00Z' }),
    }))

    expect(result.allowed).toBe(true)
  })

  it('la autoexclusión gana sobre cualquier otro motivo', () => {
    // Sorteo cerrado Y autoexcluido: el motivo que se informa es la exclusion,
    // para que nadie crea que reabriendo el sorteo se destraba.
    const result = checkParticipation(request({
      raffle: raffle({ status: 'closed' }),
      account: account({ selfExcludedUntil: '2026-12-01T00:00:00Z' }),
    }))

    expect(result.reason).toBe('self_excluded')
  })

  it('bloquea a un menor de la edad mínima', () => {
    const result = checkParticipation(request({ account: account({ age: 16 }) }))

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('under_age')
  })

  it('sin edad cargada no bloquea, pero el aviso legal sigue estando', () => {
    expect(checkParticipation(request({ account: account({ age: null }) })).allowed).toBe(true)
    expect(responsiblePlayNotice(raffle())).toContain('mayores de 18')
  })

  it('el aviso dice que los puntos no vuelven ni valen dinero', () => {
    const notice = responsiblePlayNotice(raffle())

    expect(notice).toContain('no se devuelven')
    expect(notice).toContain('no garantiza')
    expect(notice).toContain('autoexclusión')
  })
})

describe('estado del sorteo', () => {
  it('un borrador no acepta participación', () => {
    expect(checkParticipation(request({ raffle: raffle({ status: 'draft' }) })).reason)
      .toBe('raffle_not_published')
  })

  it('no se puede participar antes de que empiece', () => {
    const result = checkParticipation(request({
      raffle: raffle({ startsAt: '2026-09-15T00:00:00Z', endsAt: '2026-09-20T00:00:00Z' }),
    }))

    expect(result.reason).toBe('raffle_not_started')
  })

  it('no se puede participar después del cierre', () => {
    const result = checkParticipation(request({
      raffle: raffle({ startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-20T00:00:00Z' }),
    }))

    expect(result.reason).toBe('raffle_ended')
  })
})

describe('límites', () => {
  it('rechaza si no le alcanzan los puntos y dice cuántos faltan', () => {
    const result = checkParticipation(request({ account: account({ balance: 70 }), quantity: 2 }))

    expect(result.reason).toBe('insufficient_points')
    expect(result.message).toContain('30')
  })

  it('respeta el tope por persona contando lo que ya tiene', () => {
    const result = checkParticipation(request({ quantity: 3, ticketsAlreadyOwned: 8 }))

    expect(result.reason).toBe('per_customer_limit')
    expect(result.message).toContain('Ya tiene 8')
  })

  it('no deja pasar del cupo total del sorteo', () => {
    const result = checkParticipation(request({
      raffle: raffle({ maxTicketsTotal: 100 }),
      quantity: 5,
      ticketsIssuedTotal: 98,
    }))

    expect(result.reason).toBe('pool_exhausted')
    expect(result.message).toContain('2')
  })

  it('rechaza cantidades absurdas', () => {
    expect(checkParticipation(request({ quantity: 0 })).reason).toBe('invalid_quantity')
    expect(checkParticipation(request({ quantity: -5 })).reason).toBe('invalid_quantity')
    expect(checkParticipation(request({
      account: account({ balance: 999_999 }),
      raffle: raffle({ maxTicketsPerCustomer: null }),
      quantity: MAX_TICKETS_PER_OPERATION + 1,
    })).reason).toBe('invalid_quantity')
  })
})

describe('maxTicketsAllowed', () => {
  it('toma el más chico de saldo, tope personal y cupo', () => {
    // saldo alcanza para 10, tope personal deja 4, cupo deja 50.
    expect(maxTicketsAllowed({
      raffle: raffle({ maxTicketsPerCustomer: 10 }),
      account: account({ balance: 500 }),
      ticketsAlreadyOwned: 6,
      ticketsIssuedTotal: 950,
      now: NOW,
    })).toBe(4)
  })

  it('el saldo manda cuando es lo más chico', () => {
    expect(maxTicketsAllowed({
      raffle: raffle(),
      account: account({ balance: 120 }),
      ticketsAlreadyOwned: 0,
      ticketsIssuedTotal: 0,
      now: NOW,
    })).toBe(2)
  })

  it('sin tope personal sigue acotado por el máximo por operación', () => {
    expect(maxTicketsAllowed({
      raffle: raffle({ maxTicketsPerCustomer: null, maxTicketsTotal: 1_000_000 }),
      account: account({ balance: 10_000_000 }),
      ticketsAlreadyOwned: 0,
      ticketsIssuedTotal: 0,
      now: NOW,
    })).toBe(MAX_TICKETS_PER_OPERATION)
  })

  it('nunca devuelve negativo si el cliente ya se pasó del tope', () => {
    expect(maxTicketsAllowed({
      raffle: raffle({ maxTicketsPerCustomer: 5 }),
      account: account({ balance: 5000 }),
      ticketsAlreadyOwned: 9,
      ticketsIssuedTotal: 0,
      now: NOW,
    })).toBe(0)
  })
})
