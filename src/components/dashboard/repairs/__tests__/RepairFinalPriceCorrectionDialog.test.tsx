import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairFinalPriceCorrectionDialog } from '../RepairFinalPriceCorrectionDialog'

afterEach(() => vi.unstubAllGlobals())
const repair = {
  id: 'repair-1', status: 'entregado', finalCost: 200_000, estimatedCost: 200_000, paidAmount: 100_000, laborCost: 100_000,
  customer: { name: 'Cliente', phone: '', email: '' }, device: 'Teléfono', deviceType: 'smartphone', brand: '', model: '', issue: '', description: '', priority: 'medium', urgency: 'normal', technician: null, location: '', warranty: null, createdAt: '', estimatedCompletion: null, completedAt: null, lastUpdate: '', progress: 100, customerRating: null, notes: [], parts: [], images: [], notifications: { customer: false, technician: false, manager: false },
} satisfies Repair

describe('RepairFinalPriceCorrectionDialog', () => {
  it('previews and submits a corrected final price without changing paid amount', async () => {
    const user = userEvent.setup(); const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RepairFinalPriceCorrectionDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const price = screen.getByLabelText('Nuevo precio final'); await user.clear(price); await user.type(price, '250000')
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Precio final digitado incorrectamente')
    await user.click(screen.getByRole('button', { name: 'Revisar corrección' }))
    expect(screen.getByText('Nuevo saldo pendiente')).toBeTruthy(); expect(screen.getAllByText(/150\.000/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Confirmar nuevo precio' }))
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ newFinalTotal: 250_000, reason: 'Precio final digitado incorrectamente' })
  })

  it('blocks a price below the amount already paid and directs the user to after-sales', async () => {
    const user = userEvent.setup()
    render(<RepairFinalPriceCorrectionDialog open repair={{ ...repair, paidAmount: 200_000 }} onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const price = screen.getByLabelText('Nuevo precio final'); await user.clear(price); await user.type(price, '150000')
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Precio final digitado incorrectamente')
    expect(screen.getByRole('alert').textContent).toMatch(/excedente de.*50\.000/i)
    expect(screen.getByRole('button', { name: 'Revisar corrección' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Ir a Posventa' }).hasAttribute('disabled')).toBe(false)
  })
})
