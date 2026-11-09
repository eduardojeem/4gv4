import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { PartPurchaseDialog } from '../PartPurchaseDialog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number) => `Gs ${amount}`,
  formatThousands: (value: number | string | null | undefined) => (value ? String(value) : ''),
  parseThousands: (value: string) => Number(String(value).replace(/\D/g, '')) || 0,
}))

const repair = {
  id: 'repair-1',
  customer: { name: 'Ana', phone: '0981111222', email: '' },
  brand: 'Samsung',
  model: 'A05',
  device: 'Samsung A05',
  parts: [{ id: 1, name: 'Vidrio', quantity: 1, cost: 10, supplier: 'Distribuidora X' }],
} as unknown as Repair

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function fill() {
  fireEvent.change(screen.getByLabelText('Repuesto'), { target: { value: 'Pantalla Samsung A05' } })
  fireEvent.change(screen.getByLabelText('Te costó (c/u)'), { target: { value: '180000' } })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('PartPurchaseDialog', () => {
  it('sugiere el precio con margen y manda la compra en un solo paso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ repair: {}, expense: { recorded: true } }))
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    render(<PartPurchaseDialog open repair={repair} branchId="branch-1" onOpenChange={vi.fn()} onSaved={onSaved} />)
    fill()
    expect(screen.getByLabelText('Le cobrás (c/u)')).toHaveValue('252000')
    fireEvent.click(screen.getByRole('button', { name: /Agregar a la reparación/ }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/repairs/repair-1/part-purchase')
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      name: 'Pantalla Samsung A05', quantity: 1, unitCost: 180000, unitPrice: 252000, payment: 'cash', arrived: true, productId: null,
    })
  })

  it('si no llegó pide la fecha, y con «guardar en el catálogo» crea el producto con el stock comprado', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: true, data: { id: '11111111-1111-4111-8111-111111111111' } }, 201))
      .mockResolvedValueOnce(json({ repair: {}, expense: { recorded: true } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PartPurchaseDialog open repair={repair} branchId="branch-1" onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /Lo pedí, todavía no llegó/ }))
    expect(screen.getByRole('button', { name: /Agregar a la reparación/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('¿Cuándo llega?'), { target: { value: '2099-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: /Todavía no/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Agregar a la reparación/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      arrived: false, expectedOn: '2099-12-31', payment: 'owed', productId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('ofrece los proveedores que ya usó la reparación', () => {
    render(<PartPurchaseDialog open repair={repair} branchId="branch-1" onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    expect(document.querySelector('#purchase-suppliers option')?.getAttribute('value')).toBe('Distribuidora X')
  })
})
