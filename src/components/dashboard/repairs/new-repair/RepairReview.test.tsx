import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { RepairReview } from './RepairReview'

expect.extend(toHaveNoViolations)

const reviewProps = {
  open: true,
  onOpenChange: () => undefined,
  onConfirm: vi.fn(),
  submitting: false,
  customer: { name: 'Ana López', phone: '0981000000', wholesale: true },
  priority: 'high' as const,
  devices: [{
    brand: 'Samsung', model: 'A05', serialNumber: 'SN-123', issue: 'No enciende',
    description: 'Se apagó durante la carga', accessType: 'pin', technician: 'Carlos',
  }],
  parts: [{ name: 'Módulo A05', quantity: 1, cost: 120000, stockAvailable: 1 }],
  pricing: { labor: 80000, discount: 0, total: 200000, deposit: 50000 },
  warranty: { months: 3, type: 'full' as const },
}

describe('RepairReview', () => {
  it('shows the consolidated repair data before confirmation', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<RepairReview {...reviewProps} onConfirm={onConfirm} />)

    expect(screen.getByText('Ana López')).toBeVisible()
    expect(screen.getByText('Cliente mayorista')).toBeVisible()
    expect(screen.getByText(/Samsung A05/)).toBeVisible()
    expect(screen.getByText(/SN-123/)).toBeVisible()
    expect(screen.getByText(/Se apagó durante la carga/)).toBeVisible()
    expect(screen.getByText(/Prioridad alta/)).toBeVisible()
    expect(screen.getByText(/Stock validado: 1/)).toBeVisible()
    expect(screen.getByText(/Módulo A05/)).toBeVisible()
    expect(screen.getByText(/Gs\.\s*200\.000/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar reparación' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<RepairReview {...reviewProps} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
