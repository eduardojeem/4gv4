/**
 * Canje de puntos por números.
 *
 * La pantalla tiene que explicar por qué no se puede canjear antes de que el
 * usuario apriete el botón — si solo mostrara el error del servidor, el cajero
 * se enteraría del tope o de la autoexclusión recién al fallar, delante del
 * cliente. La base vuelve a validar todo igual; esto es para que la negativa
 * llegue con explicación.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RaffleRedeemDialog } from '@/components/dashboard/loyalty/RaffleRedeemDialog'
import type { RaffleRow } from '@/hooks/use-loyalty'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const CUSTOMER = { id: 'c-1', name: 'Ana Duarte', phone: '0981000000' }

function raffle(overrides: Partial<RaffleRow> = {}): RaffleRow {
  return {
    id: 'r-1',
    name: 'Sorteo aniversario',
    description: null,
    prizes: [{ position: 1, title: 'Celular' }],
    requirements: null,
    terms: null,
    starts_at: '2026-08-01T00:00:00Z',
    ends_at: '2026-12-01T00:00:00Z',
    points_per_ticket: 50,
    max_tickets_per_customer: 10,
    max_tickets_total: 1000,
    status: 'published',
    min_age: 18,
    drawn_at: null,
    draw_seed: null,
    tickets: [{ count: 40 }],
    ...overrides,
  }
}

/** Respuestas del servidor, ajustables por test. */
const server = {
  balance: 500,
  selfExcludedUntil: null as string | null,
  ticketsOfCustomer: [] as Array<{ raffle: { id: string } }>,
  redeemOk: true,
  redeemNumbers: [7, 19, 23],
  redeemError: 'El sorteo ya cerró.',
}

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

beforeEach(() => {
  server.balance = 500
  server.selfExcludedUntil = null
  server.ticketsOfCustomer = []
  server.redeemOk = true

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.startsWith('/api/customers')) {
      return new Response(JSON.stringify({ success: true, data: [CUSTOMER] }), { status: 200 })
    }

    if (url.startsWith('/api/loyalty/customers/')) {
      return new Response(JSON.stringify({
        moduleInstalled: true,
        account: { balance: server.balance, self_excluded_until: server.selfExcludedUntil },
        ledger: [],
        tickets: server.ticketsOfCustomer,
        winners: [],
      }), { status: 200 })
    }

    if (url.includes('/tickets') && init?.method === 'POST') {
      if (!server.redeemOk) {
        return new Response(JSON.stringify({ error: server.redeemError }), { status: 400 })
      }
      return new Response(JSON.stringify({
        tickets: server.redeemNumbers.map((n) => ({ ticket_number: n })),
      }), { status: 201 })
    }

    return new Response(JSON.stringify({}), { status: 200 })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openWithCustomer(props: Partial<RaffleRow> = {}) {
  const onRedeemed = vi.fn()
  render(
    <RaffleRedeemDialog raffle={raffle(props)} onOpenChange={vi.fn()} onRedeemed={onRedeemed} />
  )

  await userEvent.type(screen.getByLabelText('Cliente'), 'Ana')
  // El botón de buscar es el único sin texto dentro del bloque de cliente.
  const buttons = screen.getAllByRole('button')
  await userEvent.click(buttons.find((b) => b.textContent === '')!)

  await screen.findByText('Ana Duarte')
  await userEvent.click(screen.getByText('Ana Duarte'))
  await waitFor(() => expect(screen.getByText(/500 puntos/)).toBeInTheDocument())

  return { onRedeemed }
}

describe('RaffleRedeemDialog — camino feliz', () => {
  it('muestra el costo, el saldo restante y la chance real de ganar', async () => {
    await openWithCustomer()

    expect(screen.getByText(/Cuesta/)).toHaveTextContent('50 puntos')
    // 500 - 50 = 450
    expect(screen.getByText('450')).toBeInTheDocument()
    // 1 de 41 números ≈ 2.4 %
    expect(screen.getByText(/2\.4 %/)).toBeInTheDocument()
  })

  it('canjea y muestra los números asignados', async () => {
    const { onRedeemed } = await openWithCustomer()

    await userEvent.click(screen.getByRole('button', { name: /Canjear 50 puntos/ }))

    expect(await screen.findByText('Números asignados')).toBeInTheDocument()
    for (const n of server.redeemNumbers) {
      expect(screen.getByText(String(n))).toBeInTheDocument()
    }
    expect(onRedeemed).toHaveBeenCalled()
  })
})

describe('RaffleRedeemDialog — explica la negativa antes de intentar', () => {
  it('bloquea al cliente autoexcluido, aunque tenga saldo de sobra', async () => {
    server.selfExcludedUntil = '2099-01-01T00:00:00Z'
    await openWithCustomer()

    expect(screen.getByText(/pidió no participar en sorteos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Canjear/ })).toBeDisabled()
  })

  it('avisa cuando no le alcanzan los puntos y dice cuántos faltan', async () => {
    server.balance = 30
    render(<RaffleRedeemDialog raffle={raffle()} onOpenChange={vi.fn()} onRedeemed={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Cliente'), 'Ana')
    await userEvent.click(screen.getAllByRole('button').find((b) => b.textContent === '')!)
    await screen.findByText('Ana Duarte')
    await userEvent.click(screen.getByText('Ana Duarte'))

    expect(await screen.findByText(/Le faltan 20 puntos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Canjear/ })).toBeDisabled()
  })

  it('respeta el tope por persona contando lo que ya tiene', async () => {
    server.ticketsOfCustomer = Array.from({ length: 10 }, () => ({ raffle: { id: 'r-1' } }))
    await openWithCustomer()

    expect(screen.getByText(/Máximo 10 números por persona/)).toBeInTheDocument()
    expect(screen.getByText(/puede llevar hasta 0/)).toBeInTheDocument()
  })

  it('no cuenta los números de otros sorteos contra el tope de este', async () => {
    // Si contara todos, un cliente con numeros en otro sorteo quedaria
    // bloqueado sin motivo.
    server.ticketsOfCustomer = Array.from({ length: 10 }, () => ({ raffle: { id: 'otro-sorteo' } }))
    await openWithCustomer()

    expect(screen.queryByText(/Máximo 10 números por persona/)).toBeNull()
    expect(screen.getByRole('button', { name: /Canjear 50 puntos/ })).toBeEnabled()
  })

  it('muestra el aviso de juego responsable con la edad del sorteo', async () => {
    await openWithCustomer({ min_age: 21 })

    expect(screen.getByText(/mayores de 21 años/)).toBeInTheDocument()
    expect(screen.getByText(/no se devuelven/)).toBeInTheDocument()
  })
})

describe('RaffleRedeemDialog — el servidor sigue mandando', () => {
  it('muestra el rechazo del servidor aunque la pantalla creyera que se podía', async () => {
    // La validacion local es una cortesia: si el sorteo cerro entre que se
    // abrio el dialogo y se confirmo, manda la respuesta de la base.
    server.redeemOk = false
    const { onRedeemed } = await openWithCustomer()

    await userEvent.click(screen.getByRole('button', { name: /Canjear 50 puntos/ }))

    await waitFor(() => expect(onRedeemed).not.toHaveBeenCalled())
    expect(screen.queryByText('Números asignados')).toBeNull()
  })
})
