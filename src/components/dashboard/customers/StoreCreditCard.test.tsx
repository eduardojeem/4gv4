import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreCreditCard } from './StoreCreditCard'

afterEach(() => vi.restoreAllMocks())

describe('StoreCreditCard', () => {
  it('shows the balance and an auditable movement history', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          balance: 150000,
          movements: [
            { id: '1', amount: 200000, reason: 'Devolución PS-10', source_type: 'after_sales', source_id: 'case-1', created_at: '2026-08-16T12:00:00Z' },
            { id: '2', amount: -50000, reason: 'Aplicado en venta POS-20', source_type: 'sale', source_id: 'sale-1', created_at: '2026-08-16T13:00:00Z' },
          ],
          pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
        },
      }),
    } as Response)

    render(<StoreCreditCard customerId="customer-1" />)

    expect(await screen.findByText('Saldo a favor')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver movimientos/i }))
    expect(screen.getByText('Devolución PS-10')).toBeInTheDocument()
    expect(screen.getByText(/^Posventa/)).toBeInTheDocument()
    expect(screen.getByText(/^Venta/)).toBeInTheDocument()
    expect(screen.getByText(/-.*50/i)).toBeInTheDocument()
  })

  it('explains a load failure and lets the user retry', async () => {
    const request = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { balance: 0, movements: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }),
      } as Response)

    render(<StoreCreditCard customerId="customer-1" />)

    expect(await screen.findByText(/no se pudo cargar el saldo/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/sin saldo disponible/i)).toBeInTheDocument()
  })
})
