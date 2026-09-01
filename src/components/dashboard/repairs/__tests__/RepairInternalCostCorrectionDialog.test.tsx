import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairInternalCostCorrectionDialog } from '../RepairInternalCostCorrectionDialog'

afterEach(() => vi.unstubAllGlobals())

const repair = {
  id: 'repair-1', status: 'entregado', finalCost: 200_000, estimatedCost: 200_000, laborCost: 0,
  customer: { name: 'Cliente', phone: '', email: '' }, device: 'Teléfono', deviceType: 'smartphone', brand: '', model: '',
  issue: '', description: '', priority: 'medium', urgency: 'normal', technician: null, location: '', warranty: null,
  createdAt: '', estimatedCompletion: null, completedAt: null, lastUpdate: '', progress: 100, customerRating: null,
  notes: [], images: [], notifications: { customer: false, technician: false, manager: false },
  parts: [{ id: 1, databaseId: '11111111-1111-4111-8111-111111111111', name: 'Pantalla', cost: 100_000, internalCost: 95, quantity: 1, supplier: '', partNumber: '' }],
} satisfies Repair

describe('RepairInternalCostCorrectionDialog', () => {
  it('previews the corrected margin and sends only the changed internal cost', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<RepairInternalCostCorrectionDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const costInput = screen.getByLabelText('Nuevo costo interno')
    await user.clear(costInput)
    await user.type(costInput, '95000')
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Error de digitación: faltaron tres ceros')
    await user.click(screen.getByRole('button', { name: 'Revisar corrección' }))

    expect(screen.getByText('Ganancia corregida')).toBeVisible()
    expect(screen.getAllByText(/105\.000/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Confirmar corrección' }))
    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      corrections: [{ partId: '11111111-1111-4111-8111-111111111111', unitCost: 95_000 }],
      reason: 'Error de digitación: faltaron tres ceros',
    })
  })
})
