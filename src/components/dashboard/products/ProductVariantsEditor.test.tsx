import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProductVariantsEditor } from './ProductVariantsEditor'

describe('ProductVariantsEditor', () => {
  it('shows cosmetic suggestions and generates tone-volume combinations', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ProductVariantsEditor
        businessVertical="cosmetics"
        value={{ hasVariants: false, attributes: [], variants: [] }}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Producto con variantes' }))
    const enabled = onChange.mock.calls.at(-1)?.[0]
    rerender(
      <ProductVariantsEditor
        businessVertical="cosmetics"
        value={enabled}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    expect(screen.getByRole('button', { name: /Tono/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volumen/ })).toBeInTheDocument()
  })

  it('keeps an edited price when combinations are regenerated', () => {
    const onChange = vi.fn()
    render(
      <ProductVariantsEditor
        businessVertical="clothing"
        value={{
          hasVariants: true,
          attributes: [
            { key: 'color', label: 'Color', control: 'color', options: ['Negro'] },
            { key: 'size', label: 'Talle', control: 'select', options: ['M', 'L'] },
          ],
          variants: [{
            clientKey: 'color=Negro|size=M',
            name: 'Negro / M',
            attributes: { color: 'Negro', size: 'M' },
            sku: 'REM-M',
            purchasePrice: 50_000,
            salePrice: 95_000,
            minStock: 0,
            stockQuantity: 1,
            isActive: true,
          }],
        }}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Generar combinaciones' }))
    const next = onChange.mock.calls.at(-1)?.[0]

    expect(next.variants.find((variant: { clientKey: string }) => variant.clientKey === 'color=Negro|size=M').salePrice).toBe(95_000)
    expect(next.variants).toHaveLength(2)
  })
})
