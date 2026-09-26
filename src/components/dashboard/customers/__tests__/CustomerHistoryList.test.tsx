import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerHistoryList } from '../CustomerHistoryList'

const CUSTOMER = '44444444-4444-4444-8444-444444444444'

const item = (overrides: Record<string, unknown>) => ({
  id: 'x',
  kind: 'sale',
  date: '2026-09-01T10:00:00Z',
  reference: 'V-1',
  title: 'Venta',
  detail: 'Funda',
  total: 50000,
  paid: 50000,
  balance: 0,
  payment: 'paid',
  overdue: false,
  status: 'completed',
  ...overrides,
})

function servidor(items: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      items,
      summary: { salesCount: 1, repairsCount: 2, repairsInShop: 1, owed: 300000, dueOnPickup: 120000, withBalance: 2, overdueCount: 0 },
      truncated: false,
    }),
  })))
}

const montar = (props: Partial<React.ComponentProps<typeof CustomerHistoryList>> = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CustomerHistoryList customerId={CUSTOMER} {...props} />
    </SWRConfig>,
  )

afterEach(() => { vi.unstubAllGlobals() })

describe('historial de la ficha del cliente', () => {
  const items = [
    item({ id: 'r1', kind: 'repair', title: 'Samsung A54', reference: 'R-200', status: 'entregado', delivered: true, total: 750000, paid: 450000, balance: 300000, payment: 'credit', nextDueDate: '2026-10-10' }),
    item({ id: 'r2', kind: 'repair', title: 'iPhone 11', reference: 'R-201', status: 'listo', delivered: false, total: 120000, paid: 0, balance: 120000, payment: 'unpaid' }),
    item({ id: 's1' }),
  ]

  /** Antes toda venta decía «Pendiente» y la reparación a crédito decía «Pagado». */
  it('dice por operación si está pagada, a crédito o por cobrar', async () => {
    servidor(items)
    montar({ onCollect: vi.fn() })

    const filas = await screen.findAllByRole('listitem')
    expect(within(filas[0]).getByText(/A crédito · debe/)).toBeInTheDocument()
    expect(within(filas[0]).getByText(/Pagó .* de /)).toBeInTheDocument()
    expect(within(filas[1]).getByText(/Por cobrar/)).toBeInTheDocument()
    expect(within(filas[1]).getByText('Se cobra al retirar')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Listo para Entrega')).toBeInTheDocument()
    expect(within(filas[2]).getByText('Pagado')).toBeInTheDocument()
    // Solo lo que tiene saldo ofrece cobrar.
    expect(within(filas[2]).queryByRole('button', { name: /Cobrar/ })).toBeNull()
    expect(within(filas[0]).getByRole('button', { name: /Cobrar/ })).toBeInTheDocument()
  })

  it('filtra lo que tiene saldo', async () => {
    servidor(items)
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: /Con saldo/ }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
  })

  it('muestra el resumen de deuda y lo que se cobra al retirar', async () => {
    servidor(items)
    montar({ showSummary: true })
    expect(await screen.findByText('Por cobrar al retirar')).toBeInTheDocument()
    expect(screen.getByText('Deuda')).toBeInTheDocument()
  })

  it('si falla la carga lo dice y deja reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: 'No se pudo cargar el historial del cliente.' }) })))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el historial del cliente.')
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
