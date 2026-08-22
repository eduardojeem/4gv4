import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/types/product-unified'
import { ProductCard } from '../ProductCard'

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString('es-PY')}`

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'product-1',
    name: 'Notebook',
    sku: 'NB-1',
    sale_price: 1_200_000,
    purchase_price: 800_000,
    stock_quantity: 4,
    is_active: true,
    installments_enabled: true,
    installments_plans: [{ count: 12, rate: 12 }],
    ...overrides,
  } as Product
}

describe('ProductCard financing summary', () => {
  it.each(['grid', 'list'] as const)('shows financing summary in %s view', (viewMode) => {
    render(
      <ProductCard
        product={makeProduct({})}
        addToCart={vi.fn()}
        formatCurrency={formatGs}
        viewMode={viewMode}
      />,
    )

    expect(screen.getByText('Hasta 12 cuotas')).toBeInTheDocument()
    expect(screen.getByText(/Desde Gs\. 112\.000\/mes/)).toBeInTheDocument()
    expect(screen.getByText('Tasa 12%')).toBeInTheDocument()
  })

  it('uses the effective wholesale price for the installment amount', () => {
    render(
      <ProductCard
        product={makeProduct({ wholesale_price: 600_000 })}
        addToCart={vi.fn()}
        formatCurrency={formatGs}
        isWholesale
      />,
    )

    expect(screen.getByText(/Desde Gs\. 56\.000\/mes/)).toBeInTheDocument()
  })

  it('does not show financing copy for a cash-only product', () => {
    render(
      <ProductCard
        product={makeProduct({ installments_enabled: false })}
        addToCart={vi.fn()}
        formatCurrency={formatGs}
      />,
    )

    expect(screen.queryByText(/cuotas/)).not.toBeInTheDocument()
  })
})
