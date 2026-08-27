import { describe, expect, it } from 'vitest'
import {
  allocateTicketNumbers,
  createSeededRng,
  drawWinners,
  winningOdds,
  type RafflePrize,
  type RaffleTicket,
} from './draw'

const prizes: RafflePrize[] = [
  { position: 1, title: 'Celular' },
  { position: 2, title: 'Auricular' },
  { position: 3, title: 'Funda' },
]

function tickets(spec: Array<[customerId: string, count: number]>): RaffleTicket[] {
  const out: RaffleTicket[] = []
  let n = 1
  for (const [customerId, count] of spec) {
    for (let i = 0; i < count; i += 1) {
      out.push({ id: `${customerId}-${i}`, customerId, ticketNumber: n })
      n += 1
    }
  }
  return out
}

describe('createSeededRng', () => {
  it('la misma semilla da siempre la misma secuencia: el sorteo es reproducible', () => {
    const a = createSeededRng('sorteo-agosto')
    const b = createSeededRng('sorteo-agosto')

    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('semillas distintas dan secuencias distintas', () => {
    const a = createSeededRng('semilla-a')
    const b = createSeededRng('semilla-b')

    expect(a()).not.toBe(b())
  })

  it('devuelve valores dentro de [0, 1)', () => {
    const rng = createSeededRng('rango')
    for (let i = 0; i < 500; i += 1) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('allocateTicketNumbers', () => {
  it('entrega la cantidad pedida, sin repetir y dentro del pool', () => {
    const numbers = allocateTicketNumbers(1000, [], 5, createSeededRng('a'))

    expect(numbers).toHaveLength(5)
    expect(new Set(numbers).size).toBe(5)
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(1000)
    }
  })

  it('nunca reasigna un número ya tomado', () => {
    const taken = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const numbers = allocateTicketNumbers(10, taken, 1, createSeededRng('b'))

    expect(numbers).toEqual([10])
  })

  it('funciona con el pool casi lleno, donde el muestreo al azar fallaría', () => {
    // 99 de 100 tomados: hay que caer justo en el unico libre.
    const taken = new Set(Array.from({ length: 99 }, (_, i) => i + 1))
    const numbers = allocateTicketNumbers(100, taken, 1, createSeededRng('c'))

    expect(numbers).toEqual([100])
  })

  it('entrega lo que queda si se piden más números que los libres', () => {
    const taken = new Set([1, 2, 3, 4, 5, 6, 7, 8])
    const numbers = allocateTicketNumbers(10, taken, 5, createSeededRng('d'))

    expect(numbers).toEqual([9, 10])
  })

  it('con el pool agotado devuelve vacío en vez de repetir', () => {
    const taken = new Set([1, 2, 3])
    expect(allocateTicketNumbers(3, taken, 2, createSeededRng('e'))).toEqual([])
  })

  it('no reparte números si los parámetros no tienen sentido', () => {
    const rng = createSeededRng('f')
    expect(allocateTicketNumbers(0, [], 5, rng)).toEqual([])
    expect(allocateTicketNumbers(100, [], 0, rng)).toEqual([])
    expect(allocateTicketNumbers(100, [], -3, rng)).toEqual([])
  })

  it('reparte parejo sobre el pool: no favorece los números bajos', () => {
    // Se sortean muchos numeros de 1 a 10 y se mira que ninguno domine.
    const counts = new Map<number, number>()
    const rng = createSeededRng('uniformidad')

    for (let round = 0; round < 2000; round += 1) {
      const [n] = allocateTicketNumbers(10, [], 1, rng)
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }

    expect(counts.size).toBe(10)
    for (const [, times] of counts) {
      // Esperado 200 por numero; se admite mucha holgura y aun asi detecta
      // un sesgo grosero como "siempre devuelve el 1".
      expect(times).toBeGreaterThan(120)
      expect(times).toBeLessThan(290)
    }
  })
})

describe('drawWinners', () => {
  const pool = tickets([['ana', 3], ['beto', 3], ['caro', 3], ['dani', 3]])

  it('asigna un ganador por premio, en orden de posición', () => {
    const winners = drawWinners(pool, prizes, createSeededRng('sorteo'))

    expect(winners).toHaveLength(3)
    expect(winners.map((w) => w.prizePosition)).toEqual([1, 2, 3])
    expect(winners.map((w) => w.prizeTitle)).toEqual(['Celular', 'Auricular', 'Funda'])
  })

  it('una misma persona no se lleva dos premios', () => {
    const winners = drawWinners(pool, prizes, createSeededRng('sorteo'))
    const customers = winners.map((w) => w.customerId)

    expect(new Set(customers).size).toBe(customers.length)
  })

  it('un mismo número no gana dos veces', () => {
    const winners = drawWinners(pool, prizes, createSeededRng('sorteo'))
    const ids = winners.map((w) => w.ticketId)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('con la misma semilla el resultado es idéntico: se puede auditar', () => {
    const a = drawWinners(pool, prizes, createSeededRng('auditoria'))
    const b = drawWinners(pool, prizes, createSeededRng('auditoria'))

    expect(a).toEqual(b)
  })

  it('reparte más premios de los que hay personas sin inventar ganadores', () => {
    const dos = tickets([['ana', 5], ['beto', 5]])
    const winners = drawWinners(dos, prizes, createSeededRng('pocos'))

    // Tres premios, dos personas: se entregan dos.
    expect(winners).toHaveLength(2)
  })

  it('tener más números aumenta la chance de ganar', () => {
    // 'ana' tiene 90 de 100 numeros: tiene que ganar el primer premio casi
    // siempre. Si el sorteo eligiera por persona en vez de por numero, esto
    // daria cerca del 50%.
    const desparejo = tickets([['ana', 90], ['beto', 10]])
    let anaGana = 0

    for (let i = 0; i < 200; i += 1) {
      const [primero] = drawWinners(desparejo, [prizes[0]], createSeededRng(`corrida-${i}`))
      if (primero.customerId === 'ana') anaGana += 1
    }

    expect(anaGana).toBeGreaterThan(150)
  })

  it('sin participantes o sin premios no hay ganadores', () => {
    expect(drawWinners([], prizes, createSeededRng('x'))).toEqual([])
    expect(drawWinners(pool, [], createSeededRng('x'))).toEqual([])
  })

  it('descarta tickets corruptos en vez de romper el sorteo', () => {
    const sucio = [...pool, { id: '', customerId: '', ticketNumber: 0 }] as RaffleTicket[]
    const winners = drawWinners(sucio, prizes, createSeededRng('sucio'))

    expect(winners).toHaveLength(3)
    expect(winners.every((w) => w.customerId !== '')).toBe(true)
  })
})

describe('winningOdds', () => {
  it('calcula la chance real sobre el total de números', () => {
    expect(winningOdds(5, 100)).toBe(0.05)
  })

  it('sin números la chance es cero, no una división rara', () => {
    expect(winningOdds(0, 100)).toBe(0)
    expect(winningOdds(5, 0)).toBe(0)
  })

  it('nunca promete más del 100 %', () => {
    expect(winningOdds(200, 100)).toBe(1)
  })
})
