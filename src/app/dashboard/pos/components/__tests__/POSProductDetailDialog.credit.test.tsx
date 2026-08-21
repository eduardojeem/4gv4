import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/types/product-unified'
import { POSProductDetailDialog } from '../POSProductDetailDialog'

const product = {
  id: 'product-1',
  name: 'Notebook',
  sku: 'NB-1',
  sale_price: 1_200_000,
  purchase_price: 800_000,
  stock_quantity: 3,
  is_active: true,
  installments_enabled: true,
  installments_plans: [{ count: 6, rate: 0 }, { count: 12, rate: 12 }],
} as Product

describe('POSProductDetailDialog financing', () => {
  it('shows all plans and their automatic requirements', () => {
    render(
      <POSProductDetailDialog
        product={product}
        open
        onOpenChange={vi.fn()}
        onAddToCart={vi.fn()}
        onUseCreditPlan={vi.fn()}
        creditContext={{
          hasCustomer: false,
          hasCreditLine: false,
          availableCredit: 0,
          isRegisterOpen: true,
        }}
      />,
    )

    expect(screen.getByText('6 cuotas')).toBeInTheDocument()
    expect(screen.getByText('12 cuotas')).toBeInTheDocument()
    expect(screen.getAllByText('Seleccionar un cliente')).toHaveLength(2)
    expect(screen.getAllByText('Asignar una línea de crédito')).toHaveLength(2)
  })

  it('selects a plan for the current quantity and closes the dialog', () => {
    const onUseCreditPlan = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <POSProductDetailDialog
        product={product}
        open
        onOpenChange={onOpenChange}
        onAddToCart={vi.fn()}
        onUseCreditPlan={onUseCreditPlan}
        creditContext={{
          hasCustomer: true,
          hasCreditLine: true,
          availableCredit: 2_000_000,
          isRegisterOpen: true,
        }}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Usar plan de 12 cuotas/i })[0])

    expect(onUseCreditPlan).toHaveBeenCalledWith(product, 1, expect.objectContaining({ count: 12, rate: 12 }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
